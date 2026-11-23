-- Contador personal de notas y tareas nuevas de la próxima comida.
-- La marca de lectura pertenece al organizador y a una preparación concreta:
-- no se comparte con su compañero ni se arrastra al siguiente turno.

CREATE TABLE IF NOT EXISTS cofradia_privada.lecturas_anotaciones_organizacion (
  preparacion_id uuid NOT NULL REFERENCES public.preparativos_organizacion_comida(id) ON DELETE CASCADE,
  cofrade_id uuid NOT NULL REFERENCES public.cofrades(id) ON DELETE CASCADE,
  vista_hasta timestamptz NOT NULL,
  PRIMARY KEY (preparacion_id, cofrade_id)
);

ALTER TABLE cofradia_privada.lecturas_anotaciones_organizacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cofradia_privada.lecturas_anotaciones_organizacion FROM PUBLIC, anon, authenticated;

-- Único acceso a la marca de lectura: RPC que valida la sesión y que el
-- cofrade sea uno de los dos organizadores del turno actualmente publicado.
CREATE OR REPLACE FUNCTION public.novedades_anotaciones_organizacion_cofrade(
  p_token text, p_marcar boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid;
  v_plan uuid;
  v_vista_hasta timestamptz;
  v_total integer;
BEGIN
  SELECT cofrade_id, preparacion_id INTO v_actor, v_plan
  FROM cofradia_privada.organizador_sesion(p_token);

  IF p_marcar THEN
    INSERT INTO cofradia_privada.lecturas_anotaciones_organizacion
      (preparacion_id, cofrade_id, vista_hasta)
    VALUES (v_plan, v_actor, clock_timestamp())
    ON CONFLICT (preparacion_id, cofrade_id) DO UPDATE
      SET vista_hasta = GREATEST(
        cofradia_privada.lecturas_anotaciones_organizacion.vista_hasta,
        EXCLUDED.vista_hasta
      );
    RETURN 0;
  END IF;

  SELECT vista_hasta INTO v_vista_hasta
  FROM cofradia_privada.lecturas_anotaciones_organizacion
  WHERE preparacion_id = v_plan AND cofrade_id = v_actor;

  SELECT (
    SELECT count(*) FROM public.comentarios_preparativos_comida c
    WHERE c.preparacion_id = v_plan
      AND c.autor_id IS NOT NULL AND c.autor_id <> v_actor
      AND c.eliminado_en IS NULL
      AND c.creado_en > COALESCE(v_vista_hasta, '-infinity'::timestamptz)
  ) + (
    SELECT count(*) FROM public.tareas_preparativos_comida t
    WHERE t.preparacion_id = v_plan
      AND t.creada_por IS NOT NULL AND t.creada_por <> v_actor
      AND t.eliminada_en IS NULL
      AND t.creada_en > COALESCE(v_vista_hasta, '-infinity'::timestamptz)
  ) INTO v_total;

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.novedades_anotaciones_organizacion_cofrade(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.novedades_anotaciones_organizacion_cofrade(text, boolean) TO anon, authenticated;
