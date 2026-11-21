-- Las fechas propuestas son disponibilidades, no preferencias excluyentes.
-- Cada cofrade puede marcar entre una y todas las fechas en las que puede asistir.
CREATE OR REPLACE FUNCTION public.crear_encuesta_fecha_organizadores(
  p_token text, p_fechas date[], p_cierre timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_plan uuid;
  v_id uuid;
  v_fecha date;
  v_i integer:=0;
BEGIN
  SELECT preparacion_id INTO v_plan
  FROM cofradia_privada.organizador_sesion(p_token);

  IF p_cierre IS NULL OR p_cierre<=now()+interval '1 hour'
    OR p_cierre>now()+interval '30 days'
    OR cardinality(p_fechas) NOT BETWEEN 2 AND 12
    OR (SELECT count(DISTINCT f) FROM unnest(p_fechas) f)<>cardinality(p_fechas)
    OR EXISTS(SELECT 1 FROM unnest(p_fechas) f
              WHERE f IS NULL OR f<=current_date OR f>current_date+365) THEN
    RAISE EXCEPTION 'Elige entre 2 y 12 fechas futuras y un cierre entre 1 hora y 30 días';
  END IF;

  PERFORM 1 FROM public.proximos_organizadores p
  WHERE p.preparacion_id=v_plan AND p.publicado FOR UPDATE;

  INSERT INTO public.preparativos_organizacion_comida(id)
  VALUES(v_plan) ON CONFLICT(id) DO NOTHING;
  PERFORM 1 FROM public.preparativos_organizacion_comida
  WHERE id=v_plan FOR UPDATE;

  IF EXISTS(SELECT 1 FROM public.preparativos_organizacion_comida
            WHERE id=v_plan AND encuesta_fecha_id IS NOT NULL) THEN
    RAISE EXCEPTION 'La encuesta de fecha ya existe. Puedes gestionarla desde el apartado de encuestas.';
  END IF;

  INSERT INTO public.encuestas_cofradia(
    titulo,descripcion,tipo,estado,abre_en,cierra_en,max_opciones,electores,
    mostrar_resultados,mostrar_ganador,mostrar_encuesta
  )
  VALUES(
    '¿Qué día nos sentamos a la mesa?',
    'Marca todas las fechas en las que podrías asistir a la próxima comida de la Cofradía.',
    'secreta','abierta',now(),p_cierre,cardinality(p_fechas)::smallint,
    'todos',true,true,true
  )
  RETURNING id INTO v_id;

  FOREACH v_fecha IN ARRAY p_fechas LOOP
    v_i:=v_i+1;
    INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
    VALUES(v_id,to_char(v_fecha,'DD/MM/YYYY'),v_i);
  END LOOP;

  UPDATE public.preparativos_organizacion_comida
  SET encuesta_fecha_id=v_id,actualizado_en=now()
  WHERE id=v_plan;

  RETURN cofradia_privada.resumen_preparacion(v_plan);
END
$function$;

-- Adaptamos también la encuesta de fecha de la organización actual si sigue abierta.
-- No tocamos sus opciones, participantes ni votos ya emitidos.
UPDATE public.encuestas_cofradia e
SET max_opciones=(
    SELECT count(*)::smallint FROM public.encuesta_opciones_cofradia o
    WHERE o.encuesta_id=e.id
  ),
  descripcion='Marca todas las fechas en las que podrías asistir a la próxima comida de la Cofradía.',
  actualizada_en=now()
FROM public.preparativos_organizacion_comida p
WHERE e.id=p.encuesta_fecha_id
  AND p.id=(SELECT pr.preparacion_id FROM public.proximos_organizadores pr WHERE pr.clave=1)
  AND p.fecha_definitiva IS NULL
  AND e.estado='abierta'
  AND e.cierra_en>now()
  AND e.max_opciones=1
  AND (SELECT count(*) FROM public.encuesta_opciones_cofradia o WHERE o.encuesta_id=e.id)
      BETWEEN 2 AND 12;
