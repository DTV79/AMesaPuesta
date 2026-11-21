-- La elección de fecha mantiene siempre una respuesta excluyente y fija al final.
-- Los dos pasos obligatorios conservan su modalidad: fecha secreta y asistencia pública.
CREATE OR REPLACE FUNCTION public.crear_encuesta_fecha_organizadores(
  p_token text,p_fechas date[],p_cierre timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan uuid;v_id uuid;v_fecha date;v_i integer:=0;
BEGIN
 SELECT preparacion_id INTO v_plan FROM cofradia_privada.organizador_sesion(p_token);
 IF p_cierre IS NULL OR p_cierre<=now()+interval '1 hour'
   OR p_cierre>now()+interval '30 days'
   OR coalesce(cardinality(p_fechas),0) NOT BETWEEN 2 AND 12
   OR (SELECT count(DISTINCT f) FROM unnest(p_fechas) f)<>cardinality(p_fechas)
   OR EXISTS(SELECT 1 FROM unnest(p_fechas) f
             WHERE f IS NULL OR f<=current_date OR f>current_date+365) THEN
   RAISE EXCEPTION 'Elige entre 2 y 12 fechas futuras y un cierre entre 1 hora y 30 días';
 END IF;
 PERFORM 1 FROM public.proximos_organizadores
 WHERE preparacion_id=v_plan AND publicado FOR UPDATE;
 INSERT INTO public.preparativos_organizacion_comida(id)
 VALUES(v_plan) ON CONFLICT(id) DO NOTHING;
 PERFORM 1 FROM public.preparativos_organizacion_comida
 WHERE id=v_plan FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.preparativos_organizacion_comida
           WHERE id=v_plan AND encuesta_fecha_id IS NOT NULL) THEN
   RAISE EXCEPTION 'La encuesta de fecha ya existe. Puedes editarla mientras esté abierta.';
 END IF;
 INSERT INTO public.encuestas_cofradia(
   titulo,descripcion,tipo,estado,abre_en,cierra_en,max_opciones,electores,
   mostrar_resultados,mostrar_ganador,mostrar_encuesta)
 VALUES('¿Qué día nos sentamos a la mesa?',
   'Marca todas las fechas que te vengan bien, o selecciona «Ninguna fecha me viene bien» si no puedes asistir en ninguna.',
   'secreta','abierta',now(),p_cierre,cardinality(p_fechas)::smallint,
   'todos',true,true,true)
 RETURNING id INTO v_id;
 FOREACH v_fecha IN ARRAY p_fechas LOOP
   v_i:=v_i+1;
   INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
   VALUES(v_id,to_char(v_fecha,'DD/MM/YYYY'),v_i);
 END LOOP;
 INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
 VALUES(v_id,'Ninguna fecha me viene bien',v_i+1);
 UPDATE public.preparativos_organizacion_comida
 SET encuesta_fecha_id=v_id,actualizado_en=now() WHERE id=v_plan;
 RETURN cofradia_privada.resumen_preparacion(v_plan);
END $fn$;

-- Reforzamos que ni un cliente antiguo ni una llamada directa a la API
-- permitan registrar «ninguna» junto con alguna fecha concreta.
CREATE OR REPLACE FUNCTION cofradia_privada.validar_voto_fecha_excluyente()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $fn$
DECLARE v_es_ninguna boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.preparativos_organizacion_comida p
               WHERE p.encuesta_fecha_id=NEW.encuesta_id) THEN
   RETURN NEW;
 END IF;
 SELECT o.texto='Ninguna fecha me viene bien' INTO v_es_ninguna
 FROM public.encuesta_opciones_cofradia o
 WHERE o.id=NEW.opcion_id AND o.encuesta_id=NEW.encuesta_id;
 IF EXISTS (
   SELECT 1 FROM public.encuesta_votos_cofradia v
   JOIN public.encuesta_opciones_cofradia o ON o.id=v.opcion_id
   WHERE v.encuesta_id=NEW.encuesta_id AND v.cofrade_id=NEW.cofrade_id
     AND v.id IS DISTINCT FROM NEW.id
     AND ((v_es_ninguna IS TRUE AND o.texto<>'Ninguna fecha me viene bien')
       OR (v_es_ninguna IS FALSE AND o.texto='Ninguna fecha me viene bien'))
 ) THEN
   RAISE EXCEPTION 'No puedes marcar fechas y «Ninguna fecha me viene bien» al mismo tiempo';
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS voto_fecha_excluyente ON public.encuesta_votos_cofradia;
CREATE TRIGGER voto_fecha_excluyente
BEFORE INSERT OR UPDATE ON public.encuesta_votos_cofradia
FOR EACH ROW EXECUTE FUNCTION cofradia_privada.validar_voto_fecha_excluyente();
REVOKE ALL ON FUNCTION cofradia_privada.validar_voto_fecha_excluyente()
FROM PUBLIC,anon,authenticated;

-- Para confirmar un día se comparan solo las fechas reales, no «Ninguna».
CREATE OR REPLACE FUNCTION public.confirmar_fecha_organizadores(p_token text,p_fecha date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan uuid;v_poll uuid;v_fecha_texto text;
        v_max integer;v_votos integer;
BEGIN
 SELECT preparacion_id INTO v_plan FROM cofradia_privada.organizador_sesion(p_token);
 PERFORM 1 FROM public.preparativos_organizacion_comida WHERE id=v_plan FOR UPDATE;
 SELECT encuesta_fecha_id INTO v_poll FROM public.preparativos_organizacion_comida WHERE id=v_plan;
 IF v_poll IS NULL OR p_fecha IS NULL OR p_fecha<current_date THEN
   RAISE EXCEPTION 'La fecha propuesta no es válida';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.encuestas_cofradia e WHERE e.id=v_poll
   AND (e.estado IN ('cerrada','archivada') OR e.cierra_en<=now())) THEN
   RAISE EXCEPTION 'Hay que esperar a que cierre la votación de fecha';
 END IF;
 IF EXISTS(SELECT 1 FROM public.preparativos_organizacion_comida
   WHERE id=v_plan AND fecha_definitiva IS NOT NULL) THEN
   RAISE EXCEPTION 'La fecha ya está confirmada. Administración puede corregirla.';
 END IF;
 v_fecha_texto:=to_char(p_fecha,'DD/MM/YYYY');
 SELECT max(o.votos) INTO v_max FROM public.encuesta_opciones_cofradia o
 WHERE o.encuesta_id=v_poll AND o.texto<>'Ninguna fecha me viene bien';
 SELECT o.votos INTO v_votos FROM public.encuesta_opciones_cofradia o
 WHERE o.encuesta_id=v_poll AND o.texto=v_fecha_texto;
 IF v_votos IS NULL OR v_max IS NULL OR v_max=0 OR v_votos<>v_max THEN
   RAISE EXCEPTION 'Confirma una fecha con votos favorables; si ninguna recibió votos, consulta con Administración';
 END IF;
 UPDATE public.preparativos_organizacion_comida
 SET fecha_definitiva=p_fecha,actualizado_en=now() WHERE id=v_plan;
 RETURN cofradia_privada.resumen_preparacion(v_plan);
END $fn$;

-- Se conserva el endpoint y la validación de propiedad de cada encuesta.
CREATE OR REPLACE FUNCTION public.editar_encuesta_organizacion_cofrade(
  p_token text,p_id uuid,p_titulo text,p_descripcion text,p_tipo text,
  p_opciones text[],p_max_opciones integer,p_cierre timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan uuid;v_p public.preparativos_organizacion_comida%rowtype;
        v_e public.encuestas_cofradia%rowtype;v_anteriores text[];v_nuevas text[];
        v_con_votos boolean;v_clase text;v_opcion text;v_pos integer:=0;
        v_fecha date;v_total integer;
BEGIN
 SELECT preparacion_id INTO v_plan FROM cofradia_privada.organizador_sesion(p_token);
 IF cofradia_privada.encuesta_de_preparacion(v_plan,p_id) IS NOT TRUE THEN
   RAISE EXCEPTION 'Esta encuesta no pertenece a vuestra organización' USING errcode='42501';
 END IF;
 SELECT * INTO v_p FROM public.preparativos_organizacion_comida WHERE id=v_plan;
 SELECT * INTO v_e FROM public.encuestas_cofradia WHERE id=p_id FOR UPDATE;
 IF v_e.id IS NULL OR v_e.estado<>'abierta' OR v_e.cierra_en<=now() THEN
   RAISE EXCEPTION 'Solo se pueden editar encuestas que siguen abiertas';
 END IF;
 v_clase:=CASE WHEN v_p.encuesta_fecha_id=p_id THEN 'fecha'
               WHEN v_p.encuesta_asistencia_id=p_id THEN 'asistencia' ELSE 'extra' END;
 SELECT array_agg(o.texto ORDER BY o.posicion) INTO v_anteriores
 FROM public.encuesta_opciones_cofradia o WHERE o.encuesta_id=p_id;
 SELECT array_agg(btrim(x) ORDER BY ord) INTO v_nuevas
 FROM unnest(p_opciones) WITH ORDINALITY AS t(x,ord);
 v_total:=coalesce(cardinality(v_nuevas),0);
 SELECT EXISTS(SELECT 1 FROM public.encuesta_participaciones_cofradia WHERE encuesta_id=p_id)
     OR EXISTS(SELECT 1 FROM public.encuesta_votos_cofradia WHERE encuesta_id=p_id)
 INTO v_con_votos;
 IF length(btrim(coalesce(p_titulo,''))) NOT BETWEEN 4 AND 180
   OR length(coalesce(p_descripcion,''))>2000
   OR coalesce(p_tipo,'') NOT IN ('secreta','participacion','publica')
   OR (v_clase='fecha' AND v_total NOT BETWEEN 3 AND 13)
   OR (v_clase<>'fecha' AND v_total NOT BETWEEN 2 AND 12)
   OR coalesce(p_max_opciones,0) NOT BETWEEN 1 AND v_total
   OR EXISTS(SELECT 1 FROM unnest(v_nuevas) x WHERE coalesce(length(x),0) NOT BETWEEN 1 AND 180)
   OR (SELECT count(DISTINCT lower(x)) FROM unnest(v_nuevas) x)<>v_total
   OR p_cierre IS NULL OR p_cierre<=now()+interval '5 minutes'
   OR p_cierre>now()+interval '30 days' THEN
   RAISE EXCEPTION 'Revisa el título, las opciones y el plazo (mínimo cinco minutos)';
 END IF;
 IF (v_clase='fecha' AND (p_tipo<>'secreta'
     OR p_max_opciones<>v_total-1
     OR v_nuevas[v_total]<>'Ninguna fecha me viene bien'
     OR (SELECT count(*) FROM unnest(v_nuevas) x
         WHERE x='Ninguna fecha me viene bien')<>1))
   OR (v_clase='asistencia' AND
       (p_tipo<>'publica' OR v_nuevas<>ARRAY['Sí, asistiré','No asistiré']::text[]
        OR p_max_opciones<>1)) THEN
   RAISE EXCEPTION 'Esta votación tiene una modalidad y opciones obligatorias';
 END IF;
 IF v_clase='asistencia' AND p_cierre::date>v_p.fecha_definitiva THEN
   RAISE EXCEPTION 'La asistencia debe cerrar antes de la comida';
 END IF;
 IF v_clase='fecha' AND v_nuevas IS DISTINCT FROM v_anteriores THEN
   FOR v_pos IN 1..(v_total-1) LOOP
     v_opcion:=v_nuevas[v_pos];
     IF v_opcion !~ '^\d{2}/\d{2}/\d{4}$' THEN
       RAISE EXCEPTION 'Las opciones de fecha deben tener formato DD/MM/AAAA';
     END IF;
     v_fecha:=to_date(v_opcion,'DD/MM/YYYY');
     IF to_char(v_fecha,'DD/MM/YYYY')<>v_opcion OR v_fecha<=current_date
        OR v_fecha>current_date+365 THEN
       RAISE EXCEPTION 'Propón únicamente fechas futuras válidas';
     END IF;
   END LOOP;
 END IF;
 IF v_con_votos AND (v_nuevas IS DISTINCT FROM v_anteriores
    OR p_max_opciones<>v_e.max_opciones OR p_tipo<>v_e.tipo) THEN
   RAISE EXCEPTION 'Ya hay votos: no se pueden cambiar las opciones ni la modalidad';
 END IF;
 UPDATE public.encuestas_cofradia
 SET titulo=btrim(p_titulo),descripcion=coalesce(p_descripcion,''),
     tipo=p_tipo,max_opciones=p_max_opciones::smallint,
     cierra_en=p_cierre,actualizada_en=now()
 WHERE id=p_id;
 IF v_nuevas IS DISTINCT FROM v_anteriores THEN
   IF v_clase='fecha' THEN
     -- No se elimina la opción fija. La apartamos para evitar colisiones
     -- con la restricción UNIQUE(encuesta_id,posicion) al cambiar fechas.
     UPDATE public.encuesta_opciones_cofradia SET posicion=20
     WHERE encuesta_id=p_id AND texto='Ninguna fecha me viene bien';
     DELETE FROM public.encuesta_opciones_cofradia
     WHERE encuesta_id=p_id AND texto<>'Ninguna fecha me viene bien';
     FOR v_pos IN 1..(v_total-1) LOOP
       INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
       VALUES(p_id,v_nuevas[v_pos],v_pos);
     END LOOP;
     UPDATE public.encuesta_opciones_cofradia SET posicion=v_total
     WHERE encuesta_id=p_id AND texto='Ninguna fecha me viene bien';
   ELSE
     DELETE FROM public.encuesta_opciones_cofradia WHERE encuesta_id=p_id;
     FOREACH v_opcion IN ARRAY v_nuevas LOOP
       v_pos:=v_pos+1;
       INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
       VALUES(p_id,v_opcion,v_pos);
     END LOOP;
   END IF;
 END IF;
 RETURN public.consultar_edicion_encuesta_organizacion_cofrade(p_token,p_id);
END $fn$;

-- Añadimos la respuesta a la votación actual sin borrar fechas ni alterar votos.
INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
SELECT p.encuesta_fecha_id,'Ninguna fecha me viene bien',
       (SELECT coalesce(max(o.posicion),0)+1 FROM public.encuesta_opciones_cofradia o
        WHERE o.encuesta_id=p.encuesta_fecha_id)
FROM public.preparativos_organizacion_comida p
JOIN public.proximos_organizadores pr ON pr.preparacion_id=p.id AND pr.clave=1
JOIN public.encuestas_cofradia e ON e.id=p.encuesta_fecha_id
WHERE e.estado='abierta' AND e.cierra_en>now()
  AND NOT EXISTS(SELECT 1 FROM public.encuesta_opciones_cofradia o
                 WHERE o.encuesta_id=p.encuesta_fecha_id
                   AND o.texto='Ninguna fecha me viene bien');

UPDATE public.encuestas_cofradia e
SET descripcion='Marca todas las fechas que te vengan bien, o selecciona «Ninguna fecha me viene bien» si no puedes asistir en ninguna.',
    actualizada_en=now()
FROM public.preparativos_organizacion_comida p
JOIN public.proximos_organizadores pr ON pr.preparacion_id=p.id AND pr.clave=1
WHERE e.id=p.encuesta_fecha_id AND e.estado='abierta' AND e.cierra_en>now()
  AND EXISTS(SELECT 1 FROM public.encuesta_opciones_cofradia o
             WHERE o.encuesta_id=e.id AND o.texto='Ninguna fecha me viene bien');
