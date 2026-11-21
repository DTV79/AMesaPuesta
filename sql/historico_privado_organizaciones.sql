-- Archivo privado de los preparativos. Se congela cuando cambia la pareja.
-- No se concede acceso directo a esta tabla desde la API pública.
CREATE TABLE IF NOT EXISTS cofradia_privada.historial_organizaciones_comida (
  preparacion_id uuid PRIMARY KEY,
  cofrade_ids uuid[] NOT NULL,
  cerrado_en timestamptz NOT NULL DEFAULT now(),
  resumen jsonb NOT NULL,
  -- Solo para una prueba temporal explícita; jamás da acceso a otros cofrades.
  demo_para uuid REFERENCES public.cofrades(id) ON DELETE CASCADE,
  CONSTRAINT historial_organizaciones_participantes
    CHECK ((demo_para IS NULL AND cardinality(cofrade_ids)=2)
        OR (demo_para IS NOT NULL AND cardinality(cofrade_ids)=0))
);

ALTER TABLE cofradia_privada.historial_organizaciones_comida ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cofradia_privada.historial_organizaciones_comida
  FROM PUBLIC, anon, authenticated;

-- La función actual ya generaba un nuevo preparacion_id al cambiar de pareja.
-- Guardamos primero una instantánea de los preparativos antiguos, sin cambiar
-- su contenido. Cambiar solo el orden de los mismos dos nombres no cierra nada.
CREATE OR REPLACE FUNCTION cofradia_privada.rotar_preparacion_organizacion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF NOT (NEW.cofrade_ids @> OLD.cofrade_ids
          AND OLD.cofrade_ids @> NEW.cofrade_ids) THEN
    IF cardinality(OLD.cofrade_ids)=2
       AND EXISTS (SELECT 1 FROM public.preparativos_organizacion_comida
                   WHERE id=OLD.preparacion_id)
       -- No crear históricos vacíos si no usaron las tareas ni las notas.
       AND (EXISTS (SELECT 1 FROM public.tareas_preparativos_comida
                    WHERE preparacion_id=OLD.preparacion_id AND eliminada_en IS NULL)
         OR EXISTS (SELECT 1 FROM public.comentarios_preparativos_comida
                    WHERE preparacion_id=OLD.preparacion_id AND eliminado_en IS NULL)) THEN
      INSERT INTO cofradia_privada.historial_organizaciones_comida
        (preparacion_id,cofrade_ids,cerrado_en,resumen)
      VALUES (
        OLD.preparacion_id, OLD.cofrade_ids, now(),
        cofradia_privada.resumen_preparacion(OLD.preparacion_id)
      )
      ON CONFLICT (preparacion_id) DO NOTHING;
    END IF;
    NEW.preparacion_id := gen_random_uuid();
  END IF;
  RETURN NEW;
END $function$;

-- Comprueba la sesión personal de cofrade, no una sesión administrativa.
-- La pareja archivada es la única que puede consultar su ficha.
CREATE OR REPLACE FUNCTION cofradia_privada.cofrade_sesion_historial(p_token text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO '' AS $function$
DECLARE v_cofrade uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) NOT BETWEEN 12 AND 600 THEN
    RAISE EXCEPTION 'Inicia sesión como cofrade' USING errcode='42501';
  END IF;
  SELECT s.cofrade_id INTO v_cofrade
    FROM cofradia_privada.sesiones_cofrades s
    JOIN public.cofrades c ON c.id=s.cofrade_id
   WHERE s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     AND s.expira_en>now() AND c.fecha_baja IS NULL;
  IF v_cofrade IS NULL THEN
    RAISE EXCEPTION 'La sesión ha caducado' USING errcode='42501';
  END IF;
  RETURN v_cofrade;
END $function$;

REVOKE ALL ON FUNCTION cofradia_privada.cofrade_sesion_historial(text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.listar_mis_organizaciones_cofrade(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO '' AS $function$
DECLARE v_cofrade uuid; v_resultado jsonb;
BEGIN
  v_cofrade := cofradia_privada.cofrade_sesion_historial(p_token);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',h.preparacion_id,
    'fecha',h.resumen->>'fecha_definitiva',
    'restaurante',h.resumen#>>'{datos,restaurante}',
    'organizadores',h.resumen->'organizadores',
    'cerrado_en',h.cerrado_en,
    'es_demo',h.demo_para IS NOT NULL
  ) ORDER BY COALESCE(h.resumen->>'fecha_definitiva','') DESC,
             h.cerrado_en DESC),'[]'::jsonb)
    INTO v_resultado
    FROM cofradia_privada.historial_organizaciones_comida h
   WHERE (h.demo_para IS NULL AND v_cofrade=ANY(h.cofrade_ids))
      OR h.demo_para=v_cofrade;
  RETURN v_resultado;
END $function$;

CREATE OR REPLACE FUNCTION public.consultar_mi_organizacion_historica_cofrade(
  p_token text, p_preparacion_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO '' AS $function$
DECLARE v_cofrade uuid; v_archivo cofradia_privada.historial_organizaciones_comida%rowtype;
BEGIN
  v_cofrade := cofradia_privada.cofrade_sesion_historial(p_token);
  SELECT * INTO v_archivo
    FROM cofradia_privada.historial_organizaciones_comida h
   WHERE h.preparacion_id=p_preparacion_id
     AND ((h.demo_para IS NULL AND v_cofrade=ANY(h.cofrade_ids))
          OR h.demo_para=v_cofrade);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No tienes acceso a este histórico' USING errcode='42501';
  END IF;
  RETURN v_archivo.resumen || jsonb_build_object(
    'cerrado_en',v_archivo.cerrado_en,'solo_lectura',true,
    'es_demo',v_archivo.demo_para IS NOT NULL);
END $function$;

-- Las funciones públicas validan el token y la pertenencia a la pareja antes
-- de acceder a la instantánea. No exponen escritura ni datos de otras parejas.
REVOKE ALL ON FUNCTION public.listar_mis_organizaciones_cofrade(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_mis_organizaciones_cofrade(text)
  TO anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_mi_organizacion_historica_cofrade(text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_mi_organizacion_historica_cofrade(text,uuid)
  TO anon, authenticated;
