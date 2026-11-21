-- Cuaderno reservado a los organizadores; entrega voluntaria a Administración.
ALTER TABLE public.preparativos_organizacion_comida
  ADD COLUMN IF NOT EXISTS entregado_en timestamptz,
  ADD COLUMN IF NOT EXISTS entregado_por uuid REFERENCES public.cofrades(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION cofradia_privada.resumen_preparacion_admin(p_plan uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_informacion jsonb;v_entregado timestamptz;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN
    RAISE EXCEPTION 'Acceso no autorizado' USING errcode='42501';
  END IF;
  SELECT entregado_en INTO v_entregado
  FROM public.preparativos_organizacion_comida WHERE id=p_plan;
  v_informacion:=cofradia_privada.resumen_preparacion(p_plan);
  -- Las tareas y la conversación nunca forman parte de la vista de Administración.
  -- El restaurante y el menú solo se comparten después de la entrega.
  RETURN (v_informacion - 'datos' - 'tareas' - 'comentarios'
    - 'revision' - 'actualizado_en' - 'actualizado_por')
    || jsonb_build_object(
       'datos',CASE WHEN v_entregado IS NOT NULL
         THEN COALESCE(v_informacion->'datos','{}'::jsonb)
         ELSE '{}'::jsonb END,
       'entregado_en',v_entregado);
END
$function$;
REVOKE ALL ON FUNCTION cofradia_privada.resumen_preparacion_admin(uuid)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.consultar_organizacion_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_plan uuid;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN
    RAISE EXCEPTION 'Acceso no autorizado' USING errcode='42501';
  END IF;
  SELECT preparacion_id INTO v_plan FROM public.proximos_organizadores WHERE clave=1;
  IF v_plan IS NULL THEN RETURN NULL; END IF;
  RETURN cofradia_privada.resumen_preparacion_admin(v_plan);
END $function$;


CREATE OR REPLACE FUNCTION public.ajustar_fecha_organizacion_admin(p_fecha date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_plan uuid;v_asistencia uuid;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN
    RAISE EXCEPTION 'Acceso no autorizado' USING errcode='42501';
  END IF;
  IF p_fecha IS NULL OR p_fecha<current_date OR p_fecha>current_date+365 THEN
    RAISE EXCEPTION 'Elige una fecha válida para la comida';
  END IF;
  SELECT preparacion_id INTO v_plan
    FROM public.proximos_organizadores WHERE clave=1 FOR UPDATE;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Todavía no hay organizadores asignados';END IF;
  INSERT INTO public.preparativos_organizacion_comida(id) VALUES(v_plan)
    ON CONFLICT(id) DO NOTHING;
  UPDATE public.preparativos_organizacion_comida
  SET fecha_definitiva=p_fecha,actualizado_en=now()
  WHERE id=v_plan
  RETURNING encuesta_asistencia_id INTO v_asistencia;
  IF v_asistencia IS NOT NULL THEN
    UPDATE public.encuestas_cofradia
    SET descripcion='Comida del '||to_char(p_fecha,'DD/MM/YYYY')||
      '. Confirma tu asistencia antes del cierre del plazo.',
      actualizada_en=now()
    WHERE id=v_asistencia
      AND descripcion LIKE 'Comida del %. Confirma tu asistencia antes del cierre del plazo.';
  END IF;
  RETURN cofradia_privada.resumen_preparacion_admin(v_plan);
END $function$;


CREATE OR REPLACE FUNCTION public.consultar_organizacion_cofrade(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid;v_actor uuid;v_entregado timestamptz;
BEGIN
  SELECT cofrade_id,preparacion_id INTO v_actor,v_id
    FROM cofradia_privada.organizador_sesion(p_token);
  SELECT entregado_en INTO v_entregado FROM public.preparativos_organizacion_comida WHERE id=v_id;
  RETURN cofradia_privada.resumen_preparacion(v_id)||jsonb_build_object('yo_id',v_actor,'entregado_en',v_entregado);
END $function$;


CREATE OR REPLACE FUNCTION public.entregar_preparativos_cofrade(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;v_plan uuid;v_datos jsonb;
  v_fecha date;v_encuesta uuid;v_entregado timestamptz;
BEGIN
  SELECT cofrade_id,preparacion_id INTO v_actor,v_plan
  FROM cofradia_privada.organizador_sesion(p_token);
  SELECT datos,fecha_definitiva,encuesta_asistencia_id,entregado_en
    INTO v_datos,v_fecha,v_encuesta,v_entregado
  FROM public.preparativos_organizacion_comida
  WHERE id=v_plan FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No hay preparativos guardados'; END IF;
  IF v_entregado IS NULL THEN
    IF v_fecha IS NULL THEN
      RAISE EXCEPTION 'Primero debéis confirmar la fecha de la comida';
    END IF;
    IF btrim(coalesce(v_datos->>'restaurante',''))='' THEN
      RAISE EXCEPTION 'Guardad antes el restaurante en el cuaderno';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.encuestas_cofradia e
      WHERE e.id=v_encuesta
        AND (e.estado IN ('cerrada','archivada')
          OR (e.cierra_en IS NOT NULL AND e.cierra_en<=now()))
    ) THEN
      RAISE EXCEPTION 'Primero debe terminar el plazo de confirmación de asistencia';
    END IF;
    UPDATE public.preparativos_organizacion_comida
    SET entregado_en=now(),entregado_por=v_actor
    WHERE id=v_plan RETURNING entregado_en INTO v_entregado;
  END IF;
  RETURN cofradia_privada.resumen_preparacion(v_plan)
    ||jsonb_build_object('yo_id',v_actor,'entregado_en',v_entregado);
END
$function$;
REVOKE ALL ON FUNCTION public.entregar_preparativos_cofrade(text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.entregar_preparativos_cofrade(text)
  TO anon,authenticated;

-- Cerrar los accesos que antes permitían a administradores leer o alterar
-- directamente el cuaderno y sus conversaciones.
REVOKE ALL ON FUNCTION public.guardar_preparativos_organizacion_admin(jsonb)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gestionar_tarea_organizacion_admin(text,uuid,text,uuid)
  FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gestionar_comentario_organizacion_admin(text,uuid,text)
  FROM PUBLIC,anon,authenticated;
