-- Encuestas propias de la pareja organizadora, sin acceso administrativo implícito
-- a los datos privados de restaurante, tareas y comentarios.
CREATE TABLE IF NOT EXISTS cofradia_privada.encuestas_extra_organizacion (
  encuesta_id uuid PRIMARY KEY REFERENCES public.encuestas_cofradia(id) ON DELETE CASCADE,
  preparacion_id uuid NOT NULL REFERENCES public.preparativos_organizacion_comida(id) ON DELETE CASCADE,
  creada_por uuid REFERENCES public.cofrades(id) ON DELETE SET NULL,
  creada_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS encuestas_extra_organizacion_preparacion_idx
  ON cofradia_privada.encuestas_extra_organizacion(preparacion_id);
ALTER TABLE cofradia_privada.encuestas_extra_organizacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cofradia_privada.encuestas_extra_organizacion FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION cofradia_privada.encuesta_de_preparacion(p_plan uuid,p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT EXISTS (
   SELECT 1 FROM public.preparativos_organizacion_comida p
   WHERE p.id=p_plan AND (p.encuesta_fecha_id=p_id OR p.encuesta_asistencia_id=p_id)
 ) OR EXISTS (
   SELECT 1 FROM cofradia_privada.encuestas_extra_organizacion x
   WHERE x.preparacion_id=p_plan AND x.encuesta_id=p_id
 );
$fn$;
REVOKE ALL ON FUNCTION cofradia_privada.encuesta_de_preparacion(uuid,uuid)
  FROM PUBLIC,anon,authenticated;

-- Resumen de las votaciones adicionales; no revela votos secretos abiertos.
CREATE OR REPLACE FUNCTION cofradia_privada.resumen_encuestas_extra(p_plan uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',e.id,'titulo',e.titulo,'descripcion',e.descripcion,
    'tipo',e.tipo,'estado',e.estado,'cierra_en',e.cierra_en,
    'max_opciones',e.max_opciones,
    'cerrada',(e.estado IN ('cerrada','archivada') OR e.cierra_en<=now()),
    'participantes',(SELECT count(*) FROM public.encuesta_participaciones_cofradia v
                     WHERE v.encuesta_id=e.id),
    'opciones',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'texto',o.texto,
       'votos',CASE WHEN e.tipo='publica' OR e.estado IN ('cerrada','archivada') OR e.cierra_en<=now()
                    THEN o.votos ELSE NULL END
    ) ORDER BY o.posicion),'[]'::jsonb)
     FROM public.encuesta_opciones_cofradia o WHERE o.encuesta_id=e.id)
 ) ORDER BY x.creada_en,e.id),'[]'::jsonb)
 FROM cofradia_privada.encuestas_extra_organizacion x
 JOIN public.encuestas_cofradia e ON e.id=x.encuesta_id
 WHERE x.preparacion_id=p_plan;
$fn$;
REVOKE ALL ON FUNCTION cofradia_privada.resumen_encuestas_extra(uuid)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.listar_encuestas_extra_organizacion_cofrade(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan uuid;
BEGIN
 SELECT preparacion_id INTO v_plan FROM cofradia_privada.organizador_sesion(p_token);
 RETURN cofradia_privada.resumen_encuestas_extra(v_plan);
END $fn$;

CREATE OR REPLACE FUNCTION public.consultar_edicion_encuesta_organizacion_cofrade(
  p_token text,p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan uuid;v_p public.preparativos_organizacion_comida%rowtype;
        v_e public.encuestas_cofradia%rowtype;
BEGIN
 SELECT preparacion_id INTO v_plan FROM cofradia_privada.organizador_sesion(p_token);
 IF cofradia_privada.encuesta_de_preparacion(v_plan,p_id) IS NOT TRUE THEN
   RAISE EXCEPTION 'Esta encuesta no pertenece a vuestra organización' USING errcode='42501';
 END IF;
 SELECT * INTO v_e FROM public.encuestas_cofradia WHERE id=p_id;
 SELECT * INTO v_p FROM public.preparativos_organizacion_comida WHERE id=v_plan;
 IF v_e.id IS NULL THEN RAISE EXCEPTION 'Encuesta no encontrada';END IF;
 RETURN jsonb_build_object(
   'id',v_e.id,'titulo',v_e.titulo,'descripcion',v_e.descripcion,'tipo',v_e.tipo,
   'cierra_en',v_e.cierra_en,'estado',v_e.estado,
   'cerrada',(v_e.estado IN ('cerrada','archivada') OR v_e.cierra_en<=now()),
   'max_opciones',v_e.max_opciones,
   'clase',CASE WHEN v_p.encuesta_fecha_id=p_id THEN 'fecha'
               WHEN v_p.encuesta_asistencia_id=p_id THEN 'asistencia' ELSE 'extra' END,
   'participantes',(SELECT count(*) FROM public.encuesta_participaciones_cofradia v
                    WHERE v.encuesta_id=p_id),
   'opciones',(SELECT COALESCE(jsonb_agg(o.texto ORDER BY o.posicion),'[]'::jsonb)
              FROM public.encuesta_opciones_cofradia o WHERE o.encuesta_id=p_id)
 );
END $fn$;

CREATE OR REPLACE FUNCTION public.crear_encuesta_extra_organizacion_cofrade(
  p_token text,p_titulo text,p_descripcion text,p_tipo text,
  p_opciones text[],p_max_opciones integer,p_cierre timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan uuid;v_actor uuid;v_id uuid;v_opcion text;v_pos integer:=0;
        v_textos text[];
BEGIN
 SELECT cofrade_id,preparacion_id INTO v_actor,v_plan
 FROM cofradia_privada.organizador_sesion(p_token);
 SELECT array_agg(btrim(x) ORDER BY ord) INTO v_textos
 FROM unnest(p_opciones) WITH ORDINALITY AS t(x,ord);
 IF length(btrim(coalesce(p_titulo,''))) NOT BETWEEN 4 AND 180
   OR length(coalesce(p_descripcion,''))>2000
   OR coalesce(p_tipo,'') NOT IN ('secreta','participacion','publica')
   OR coalesce(cardinality(v_textos),0) NOT BETWEEN 2 AND 12
   OR coalesce(p_max_opciones,0) NOT BETWEEN 1 AND coalesce(cardinality(v_textos),0)
   OR EXISTS(SELECT 1 FROM unnest(v_textos) x WHERE coalesce(length(x),0) NOT BETWEEN 1 AND 180)
   OR (SELECT count(DISTINCT lower(x)) FROM unnest(v_textos) x)<>cardinality(v_textos)
   OR p_cierre IS NULL OR p_cierre<=now()+interval '1 hour'
   OR p_cierre>now()+interval '30 days' THEN
   RAISE EXCEPTION 'Revisa el título, las opciones (2 a 12) y el plazo de la encuesta';
 END IF;
 INSERT INTO public.preparativos_organizacion_comida(id)
 VALUES(v_plan) ON CONFLICT(id) DO NOTHING;
 PERFORM 1 FROM public.preparativos_organizacion_comida WHERE id=v_plan FOR UPDATE;
 IF (SELECT count(*) FROM cofradia_privada.encuestas_extra_organizacion
     WHERE preparacion_id=v_plan)>=12 THEN
   RAISE EXCEPTION 'Ya hay 12 encuestas adicionales en esta organización';
 END IF;
 INSERT INTO public.encuestas_cofradia(
   titulo,descripcion,tipo,estado,abre_en,cierra_en,max_opciones,electores,
   mostrar_resultados,mostrar_ganador,mostrar_encuesta
 ) VALUES (
   btrim(p_titulo),coalesce(p_descripcion,''),p_tipo,'abierta',now(),p_cierre,
   p_max_opciones::smallint,'todos',true,true,true
 ) RETURNING id INTO v_id;
 FOREACH v_opcion IN ARRAY v_textos LOOP
   v_pos:=v_pos+1;
   INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
   VALUES(v_id,v_opcion,v_pos);
 END LOOP;
 INSERT INTO cofradia_privada.encuestas_extra_organizacion
   (encuesta_id,preparacion_id,creada_por) VALUES(v_id,v_plan,v_actor);
 RETURN cofradia_privada.resumen_encuestas_extra(v_plan);
END $fn$;

CREATE OR REPLACE FUNCTION public.editar_encuesta_organizacion_cofrade(
  p_token text,p_id uuid,p_titulo text,p_descripcion text,p_tipo text,
  p_opciones text[],p_max_opciones integer,p_cierre timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_plan uuid;v_p public.preparativos_organizacion_comida%rowtype;
        v_e public.encuestas_cofradia%rowtype;v_anteriores text[];v_nuevas text[];
        v_con_votos boolean;v_clase text;v_opcion text;v_pos integer:=0;
        v_fecha date;
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
 SELECT EXISTS(SELECT 1 FROM public.encuesta_participaciones_cofradia
               WHERE encuesta_id=p_id)
        OR EXISTS(SELECT 1 FROM public.encuesta_votos_cofradia
                  WHERE encuesta_id=p_id) INTO v_con_votos;
 IF length(btrim(coalesce(p_titulo,''))) NOT BETWEEN 4 AND 180
   OR length(coalesce(p_descripcion,''))>2000
   OR coalesce(p_tipo,'') NOT IN ('secreta','participacion','publica')
   OR coalesce(cardinality(v_nuevas),0) NOT BETWEEN 2 AND 12
   OR coalesce(p_max_opciones,0) NOT BETWEEN 1 AND coalesce(cardinality(v_nuevas),0)
   OR EXISTS(SELECT 1 FROM unnest(v_nuevas) x WHERE coalesce(length(x),0) NOT BETWEEN 1 AND 180)
   OR (SELECT count(DISTINCT lower(x)) FROM unnest(v_nuevas) x)<>cardinality(v_nuevas)
   OR p_cierre IS NULL OR p_cierre<=now()+interval '5 minutes'
   OR p_cierre>now()+interval '30 days' THEN
   RAISE EXCEPTION 'Revisa el título, las opciones y el plazo (mínimo cinco minutos)';
 END IF;
 IF (v_clase='fecha' AND (p_tipo<>'secreta' OR p_max_opciones<>cardinality(v_nuevas)))
   OR (v_clase='asistencia' AND
       (p_tipo<>'publica' OR v_nuevas<>ARRAY['Sí, asistiré','No asistiré']::text[]
        OR p_max_opciones<>1)) THEN
   RAISE EXCEPTION 'No se puede cambiar el funcionamiento de esta votación obligatoria';
 END IF;
 IF v_clase='asistencia' AND p_cierre::date>v_p.fecha_definitiva THEN
   RAISE EXCEPTION 'La asistencia debe cerrar antes de la comida';
 END IF;
 IF v_clase='fecha' AND v_nuevas IS DISTINCT FROM v_anteriores THEN
   FOREACH v_opcion IN ARRAY v_nuevas LOOP
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
   DELETE FROM public.encuesta_opciones_cofradia WHERE encuesta_id=p_id;
   FOREACH v_opcion IN ARRAY v_nuevas LOOP
     v_pos:=v_pos+1;
     INSERT INTO public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
     VALUES(p_id,v_opcion,v_pos);
   END LOOP;
 END IF;
 RETURN public.consultar_edicion_encuesta_organizacion_cofrade(p_token,p_id);
END $fn$;

-- Captura las votaciones adicionales para el histórico privado al cambiar la pareja.
CREATE OR REPLACE FUNCTION cofradia_privada.archivar_encuestas_extra_organizacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 UPDATE public.encuestas_cofradia e
 SET estado='cerrada',cerrada_en=now(),
     cierra_en=greatest(now(),coalesce(e.abre_en,now())+interval '1 second')
 WHERE e.id IN (SELECT encuesta_id FROM cofradia_privada.encuestas_extra_organizacion
                WHERE preparacion_id=NEW.preparacion_id)
   AND e.estado IN ('abierta','programada','pausada');
 NEW.resumen:=NEW.resumen||jsonb_build_object(
   'encuestas_extra',cofradia_privada.resumen_encuestas_extra(NEW.preparacion_id));
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS historico_organizacion_encuestas_extra ON cofradia_privada.historial_organizaciones_comida;
CREATE TRIGGER historico_organizacion_encuestas_extra
BEFORE INSERT ON cofradia_privada.historial_organizaciones_comida
FOR EACH ROW EXECUTE FUNCTION cofradia_privada.archivar_encuestas_extra_organizacion();
REVOKE ALL ON FUNCTION cofradia_privada.archivar_encuestas_extra_organizacion()
  FROM PUBLIC,anon,authenticated;

-- La API está accesible con token de cofrade y solo la pareja asignada lo supera.
REVOKE ALL ON FUNCTION public.listar_encuestas_extra_organizacion_cofrade(text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_encuestas_extra_organizacion_cofrade(text)
  TO anon,authenticated;
REVOKE ALL ON FUNCTION public.consultar_edicion_encuesta_organizacion_cofrade(text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_edicion_encuesta_organizacion_cofrade(text,uuid)
  TO anon,authenticated;
REVOKE ALL ON FUNCTION public.crear_encuesta_extra_organizacion_cofrade(text,text,text,text,text[],integer,timestamptz)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crear_encuesta_extra_organizacion_cofrade(text,text,text,text,text[],integer,timestamptz)
  TO anon,authenticated;
REVOKE ALL ON FUNCTION public.editar_encuesta_organizacion_cofrade(text,uuid,text,text,text,text[],integer,timestamptz)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.editar_encuesta_organizacion_cofrade(text,uuid,text,text,text,text[],integer,timestamptz)
  TO anon,authenticated;
