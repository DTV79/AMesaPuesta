-- Relación exacta entre el cuaderno privado de los organizadores y la comida
-- oficial importada por Administración. No inferir vínculos por fecha o nombre:
-- un mismo restaurante puede visitarse varias veces.
CREATE TABLE IF NOT EXISTS cofradia_privada.vinculos_preparacion_comida (
  preparacion_id uuid PRIMARY KEY,
  comida_id uuid NOT NULL UNIQUE REFERENCES public.comidas(id) ON DELETE CASCADE,
  vinculado_en timestamptz NOT NULL DEFAULT now(),
  vinculado_por uuid
);

ALTER TABLE cofradia_privada.vinculos_preparacion_comida ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cofradia_privada.vinculos_preparacion_comida
  FROM PUBLIC, anon, authenticated;

-- Solo se vincula al guardar la ficha que Administración ha importado desde
-- una preparación entregada. Comprobamos que la pareja siga siendo la misma.
CREATE OR REPLACE FUNCTION public.vincular_comida_organizacion_admin(
  p_preparacion uuid, p_comida uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_pareja uuid[]; v_entregado timestamptz;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN
    RAISE EXCEPTION 'Acceso no autorizado' USING errcode='42501';
  END IF;
  IF p_preparacion IS NULL OR p_comida IS NULL THEN
    RAISE EXCEPTION 'Falta identificar la organización o la comida';
  END IF;
  SELECT entregado_en INTO v_entregado
    FROM public.preparativos_organizacion_comida WHERE id=p_preparacion;
  IF v_entregado IS NULL THEN
    RAISE EXCEPTION 'La organización todavía no ha entregado su ficha';
  END IF;
  SELECT cofrade_ids INTO v_pareja FROM public.proximos_organizadores
   WHERE preparacion_id=p_preparacion;
  IF v_pareja IS NULL THEN
    SELECT cofrade_ids INTO v_pareja
      FROM cofradia_privada.historial_organizaciones_comida
     WHERE preparacion_id=p_preparacion AND demo_para IS NULL;
  END IF;
  IF cardinality(v_pareja)<>2 OR NOT EXISTS (
    SELECT 1 FROM public.comidas WHERE id=p_comida
  ) OR NOT EXISTS (
    SELECT 1 FROM public.organizadores_comida
     WHERE comida_id=p_comida AND cofrade_id=v_pareja[1]
  ) OR NOT EXISTS (
    SELECT 1 FROM public.organizadores_comida
     WHERE comida_id=p_comida AND cofrade_id=v_pareja[2]
  ) THEN
    RAISE EXCEPTION 'La comida debe corresponder a los dos organizadores de esa preparación';
  END IF;
  INSERT INTO cofradia_privada.vinculos_preparacion_comida
    (preparacion_id,comida_id,vinculado_por)
  VALUES (p_preparacion,p_comida,auth.uid())
  ON CONFLICT (preparacion_id) DO UPDATE
    SET comida_id=EXCLUDED.comida_id,
        vinculado_en=now(),vinculado_por=EXCLUDED.vinculado_por;
END $function$;

REVOKE ALL ON FUNCTION public.vincular_comida_organizacion_admin(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_comida_organizacion_admin(uuid,uuid)
  TO authenticated;

-- El listado muestra nombre y fecha actualizados cuando existe comida oficial,
-- pero sigue accesible solamente a los miembros de la pareja archivada.
CREATE OR REPLACE FUNCTION public.listar_mis_organizaciones_cofrade(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO '' AS $function$
DECLARE v_cofrade uuid; v_resultado jsonb;
BEGIN
  v_cofrade := cofradia_privada.cofrade_sesion_historial(p_token);
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',h.preparacion_id,
    'fecha',COALESCE(c.fecha::text,h.resumen->>'fecha_definitiva'),
    'restaurante',COALESCE(NULLIF(r.nombre,''),h.resumen#>>'{datos,restaurante}'),
    'organizadores',h.resumen->'organizadores',
    'cerrado_en',h.cerrado_en,
    'es_demo',h.demo_para IS NOT NULL
  ) ORDER BY COALESCE(c.fecha::text,h.resumen->>'fecha_definitiva','') DESC,
             h.cerrado_en DESC),'[]'::jsonb)
    INTO v_resultado
    FROM cofradia_privada.historial_organizaciones_comida h
    LEFT JOIN cofradia_privada.vinculos_preparacion_comida v
      ON v.preparacion_id=h.preparacion_id
    LEFT JOIN public.comidas c ON c.id=v.comida_id
    LEFT JOIN public.restaurantes r ON r.id=c.restaurante_id
   WHERE (h.demo_para IS NULL AND v_cofrade=ANY(h.cofrade_ids))
      OR h.demo_para=v_cofrade;
  RETURN v_resultado;
END $function$;

-- Los votos, tareas y notas siguen siendo la instantánea del cierre. Solo el
-- objeto comida_oficial se lee en directo, después de autorizar al cofrade.
CREATE OR REPLACE FUNCTION public.consultar_mi_organizacion_historica_cofrade(
  p_token text, p_preparacion_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO '' AS $function$
DECLARE
  v_cofrade uuid;
  v_archivo cofradia_privada.historial_organizaciones_comida%rowtype;
  v_oficial jsonb;
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

  SELECT jsonb_build_object(
      'id',c.id,'fecha',c.fecha,
      'restaurante',r.nombre,'direccion',r.direccion,
      'telefono',r.telefono,'contacto',r.persona_contacto,'web',r.web,
      'entrantes',c.menu_entrantes,'principales',c.menu_principales,
      'postres',c.menu_postres,'bebidas',c.menu_bebidas,
      'importe_total',c.importe_restaurante_total,
      'actualizado_en',c.actualizado_en
    ) INTO v_oficial
    FROM cofradia_privada.vinculos_preparacion_comida v
    JOIN public.comidas c ON c.id=v.comida_id
    LEFT JOIN public.restaurantes r ON r.id=c.restaurante_id
   WHERE v.preparacion_id=p_preparacion_id;

  RETURN v_archivo.resumen || jsonb_build_object(
    'cerrado_en',v_archivo.cerrado_en,'solo_lectura',true,
    'es_demo',v_archivo.demo_para IS NOT NULL,
    'comida_oficial',v_oficial);
END $function$;

REVOKE ALL ON FUNCTION public.listar_mis_organizaciones_cofrade(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.listar_mis_organizaciones_cofrade(text)
  TO anon, authenticated;
REVOKE ALL ON FUNCTION public.consultar_mi_organizacion_historica_cofrade(text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consultar_mi_organizacion_historica_cofrade(text,uuid)
  TO anon, authenticated;
