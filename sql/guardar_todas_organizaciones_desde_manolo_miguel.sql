-- Desde la organización de Miguel Capón y Manolo Granja (noviembre de 2026),
-- cada relevo conserva la preparación privada, aunque no se usen tareas ni notas.
-- No se importan organizaciones anteriores.
--
-- La tabla histórica y sus RPC privados ya existen por la migración previa.
CREATE OR REPLACE FUNCTION cofradia_privada.rotar_preparacion_organizacion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  -- Cambiar únicamente el orden de la misma pareja no cierra la organización.
  IF NOT (NEW.cofrade_ids @> OLD.cofrade_ids
          AND OLD.cofrade_ids @> NEW.cofrade_ids) THEN
    IF cardinality(OLD.cofrade_ids)=2 THEN
      INSERT INTO cofradia_privada.historial_organizaciones_comida
        (preparacion_id, cofrade_ids, cerrado_en, resumen)
      VALUES (
        OLD.preparacion_id,
        OLD.cofrade_ids,
        now(),
        cofradia_privada.resumen_preparacion(OLD.preparacion_id)
      )
      ON CONFLICT (preparacion_id) DO NOTHING;
    END IF;
    NEW.preparacion_id := gen_random_uuid();
  END IF;
  RETURN NEW;
END $function$;
