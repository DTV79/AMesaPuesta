-- Estadísticas de lectura exclusiva para administradores.
-- No expone papeletas ni opciones elegidas en votaciones secretas.
CREATE OR REPLACE FUNCTION public.datos_estadisticas_cofradia_admin()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, pg_temp
AS $func$
BEGIN
  IF auth.uid() IS NULL OR NOT public.soy_admin_cofradia() THEN
    RAISE EXCEPTION 'Acceso reservado a administradores';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.administradores_cofradia adm
    WHERE adm.usuario_id = auth.uid() AND adm.activo AND adm.mfa_obligatorio
  ) AND coalesce(auth.jwt()->>'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Se requiere verificación en dos pasos para consultar estadísticas';
  END IF;

  RETURN jsonb_build_object(
    'generado_en', now(),
    'cofrades', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'nombre', c.nombre, 'ingreso', c.fecha_ingreso,
      'baja', c.fecha_baja, 'categoria', c.categoria_excel,
      'fundador', c.fundador_marcado_excel
    ) ORDER BY c.nombre), '[]'::jsonb) FROM public.cofrades c),
    'config', (SELECT jsonb_build_object(
      'comidas_cofrade', x.comidas_cofrade, 'anios_cofrade', x.anios_cofrade
    ) FROM public.config_categorias_cofradia x LIMIT 1),
    'comidas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'fecha', m.fecha, 'restaurante', r.nombre,
      'restaurante_id', m.restaurante_id, 'publicada', m.publicada,
      'estado', m.estado, 'estrellas_historicas', m.resena_estrellas,
      'liquidacion_cerrada', m.liquidacion_cerrada
    ) ORDER BY m.fecha), '[]'::jsonb)
      FROM public.comidas m LEFT JOIN public.restaurantes r ON r.id=m.restaurante_id),
    'asistencias', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'comida_id', a.comida_id, 'cofrade_id', a.cofrade_id, 'estado', a.estado
    )), '[]'::jsonb) FROM public.asistencias a),
    'organizadores', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'comida_id', o.comida_id, 'cofrade_id', o.cofrade_id,
      'fuente', o.fuente
    )), '[]'::jsonb) FROM public.organizadores_comida o),
    'valoraciones', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'comida_id', v.comida_id, 'cofrade_id', v.cofrade_id,
      'comida', v.comida, 'servicio', v.servicio,
      'ambiente', v.ambiente, 'general', v.general
    )), '[]'::jsonb) FROM public.valoraciones_comida v),
    'config_valoraciones', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'comida_id', vc.comida_id, 'abierta', vc.abierta,
      'abre_en', vc.abre_en, 'cierra_en', vc.cierra_en
    )), '[]'::jsonb) FROM public.valoraciones_comida_config vc),
    'encuestas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'titulo', e.titulo, 'tipo', e.tipo,
      'electores', e.electores, 'estado', e.estado,
      'mostrar_encuesta', e.mostrar_encuesta, 'abre_en', e.abre_en,
      'cierra_en', e.cierra_en, 'cerrada_en', e.cerrada_en,
      'creada_en', e.creada_en
    ) ORDER BY e.creada_en), '[]'::jsonb) FROM public.encuestas_cofradia e),
    'participaciones', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'encuesta_id', p.encuesta_id, 'cofrade_id', p.cofrade_id
    )), '[]'::jsonb) FROM public.encuesta_participaciones_cofradia p),
    'tesoreria', public.balance_ejercicios_tesoreria_admin()
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.datos_estadisticas_cofradia_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.datos_estadisticas_cofradia_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.datos_estadisticas_cofradia_admin() TO authenticated;
