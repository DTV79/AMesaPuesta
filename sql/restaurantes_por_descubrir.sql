-- Sugerencias privadas de restaurantes. Nunca se exponen las tablas directamente.
-- Los cofrades se identifican con su sesión vigente y el administrador con MFA.

CREATE TABLE IF NOT EXISTS public.sugerencias_restaurantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  localidad text NOT NULL,
  enlace text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  precio_orientativo numeric(8,2),
  creada_por uuid NOT NULL REFERENCES public.cofrades(id) ON DELETE RESTRICT,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  estado text NOT NULL DEFAULT 'en_lista' CHECK (estado IN ('en_lista','visitado','descartado','retirado')),
  comida_id uuid REFERENCES public.comidas(id) ON DELETE SET NULL,
  CONSTRAINT sugerencias_restaurantes_nombre CHECK (char_length(btrim(nombre)) BETWEEN 3 AND 120),
  CONSTRAINT sugerencias_restaurantes_localidad CHECK (char_length(btrim(localidad)) BETWEEN 2 AND 100),
  CONSTRAINT sugerencias_restaurantes_motivo CHECK (char_length(motivo) <= 600),
  CONSTRAINT sugerencias_restaurantes_enlace CHECK (char_length(enlace) <= 500 AND (enlace = '' OR enlace ~* '^https?://')),
  CONSTRAINT sugerencias_restaurantes_precio CHECK (precio_orientativo IS NULL OR precio_orientativo BETWEEN 0 AND 2000)
);
-- Campo opcional añadido sin alterar las propuestas que ya existan.
ALTER TABLE public.sugerencias_restaurantes
  ADD COLUMN IF NOT EXISTS telefono text NOT NULL DEFAULT ''
  CHECK (char_length(telefono) <= 40);
-- Retirado: eliminación recuperable del autor. Visitado: fuera del listado de recomendaciones.
ALTER TABLE public.sugerencias_restaurantes
  DROP CONSTRAINT IF EXISTS sugerencias_restaurantes_estado_check;
ALTER TABLE public.sugerencias_restaurantes
  ADD CONSTRAINT sugerencias_restaurantes_estado_check
  CHECK (estado IN ('en_lista','visitado','descartado','retirado'));
CREATE UNIQUE INDEX IF NOT EXISTS sugerencias_restaurantes_sin_duplicados
  ON public.sugerencias_restaurantes (lower(btrim(nombre)),lower(btrim(localidad)))
  WHERE estado = 'en_lista';
CREATE INDEX IF NOT EXISTS sugerencias_restaurantes_creada_por_idx
  ON public.sugerencias_restaurantes(creada_por);
CREATE INDEX IF NOT EXISTS sugerencias_restaurantes_comida_idx
  ON public.sugerencias_restaurantes(comida_id) WHERE comida_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.intereses_sugerencias_restaurantes (
  sugerencia_id uuid NOT NULL REFERENCES public.sugerencias_restaurantes(id) ON DELETE CASCADE,
  cofrade_id uuid NOT NULL REFERENCES public.cofrades(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sugerencia_id,cofrade_id)
);
CREATE TABLE IF NOT EXISTS public.comentarios_sugerencias_restaurantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sugerencia_id uuid NOT NULL REFERENCES public.sugerencias_restaurantes(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES public.cofrades(id) ON DELETE CASCADE,
  texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 500),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comentarios_sugerencias_restaurantes_orden
  ON public.comentarios_sugerencias_restaurantes(sugerencia_id,creado_en);
CREATE INDEX IF NOT EXISTS comentarios_sugerencias_restaurantes_autor_idx
  ON public.comentarios_sugerencias_restaurantes(autor_id);
CREATE INDEX IF NOT EXISTS intereses_sugerencias_restaurantes_cofrade_idx
  ON public.intereses_sugerencias_restaurantes(cofrade_id);

ALTER TABLE public.sugerencias_restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intereses_sugerencias_restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios_sugerencias_restaurantes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sugerencias_restaurantes,public.intereses_sugerencias_restaurantes,
  public.comentarios_sugerencias_restaurantes FROM PUBLIC,anon,authenticated;

-- Helper privado: las funciones públicas validan siempre la identidad antes de llamarlo.
CREATE OR REPLACE FUNCTION cofradia_privada.resumen_sugerencias_restaurantes(
  p_cofrade uuid, p_admin boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $sql$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',s.id,'nombre',s.nombre,'localidad',s.localidad,
    'enlace',s.enlace,'telefono',s.telefono,'motivo',s.motivo,'precio_orientativo',s.precio_orientativo,
    'creada_por',s.creada_por,'proponente',COALESCE(c.nombre,'Cofrade'),
    'creada_en',s.creada_en,'estado',s.estado,
    'es_mia',s.creada_por=p_cofrade,
    'interesados',(SELECT count(*) FROM public.intereses_sugerencias_restaurantes i WHERE i.sugerencia_id=s.id),
    'me_interesa',EXISTS(SELECT 1 FROM public.intereses_sugerencias_restaurantes i WHERE i.sugerencia_id=s.id AND i.cofrade_id=p_cofrade),
    'comentarios',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',m.id,'texto',m.texto,'autor',COALESCE(autor.nombre,'Cofrade'),
      'es_mio',m.autor_id=p_cofrade,'creado_en',m.creado_en
    ) ORDER BY m.creado_en,m.id)
      FROM public.comentarios_sugerencias_restaurantes m
      LEFT JOIN public.cofrades autor ON autor.id=m.autor_id
      WHERE m.sugerencia_id=s.id),'[]'::jsonb),
    'comida_id',CASE WHEN p_admin OR (comida.publicada AND comida.fecha<=current_date) THEN comida.id ELSE null END,
    'comida_codigo',CASE WHEN p_admin OR (comida.publicada AND comida.fecha<=current_date) THEN comida.codigo_origen ELSE null END,
    'comida_fecha',CASE WHEN p_admin OR (comida.publicada AND comida.fecha<=current_date) THEN comida.fecha ELSE null END
  ) ORDER BY CASE s.estado WHEN 'en_lista' THEN 0 WHEN 'visitado' THEN 1 ELSE 2 END,
    (SELECT count(*) FROM public.intereses_sugerencias_restaurantes i WHERE i.sugerencia_id=s.id) DESC,
    s.creada_en DESC),'[]'::jsonb)
  FROM public.sugerencias_restaurantes s
  JOIN public.cofrades c ON c.id=s.creada_por
  LEFT JOIN public.comidas comida ON comida.id=s.comida_id
  WHERE p_admin OR s.estado='en_lista';
$sql$;
REVOKE ALL ON FUNCTION cofradia_privada.resumen_sugerencias_restaurantes(uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.listar_sugerencias_restaurantes_cofrade(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_cofrade uuid;
BEGIN
  v_cofrade:=cofradia_privada.cofrade_sesion_historial(p_token);
  RETURN cofradia_privada.resumen_sugerencias_restaurantes(v_cofrade,false);
END $fn$;

CREATE OR REPLACE FUNCTION public.guardar_sugerencia_restaurante_cofrade(p_token text,p_datos jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_actor uuid;
  v_id uuid;
  v_nombre text:=btrim(coalesce(p_datos->>'nombre',''));
  v_localidad text:=btrim(coalesce(p_datos->>'localidad',''));
  v_enlace text:=btrim(coalesce(p_datos->>'enlace',''));
  v_telefono text:=btrim(coalesce(p_datos->>'telefono',''));
  v_motivo text:=btrim(coalesce(p_datos->>'motivo',''));
  v_precio numeric;
BEGIN
  v_actor:=cofradia_privada.cofrade_sesion_historial(p_token);
  IF char_length(v_nombre) NOT BETWEEN 3 AND 120 OR char_length(v_localidad) NOT BETWEEN 2 AND 100
    OR char_length(v_motivo)>600 OR char_length(v_enlace)>500 OR char_length(v_telefono)>40
    OR (v_enlace<>'' AND v_enlace !~* '^https?://') THEN
    RAISE EXCEPTION 'Revisa el nombre, la localidad, el enlace y la descripción';
  END IF;
  IF coalesce(btrim(p_datos->>'precio_orientativo'),'')<>'' THEN
    v_precio:=(p_datos->>'precio_orientativo')::numeric;
    IF v_precio NOT BETWEEN 0 AND 2000 THEN RAISE EXCEPTION 'Precio no válido'; END IF;
  END IF;
  IF nullif(p_datos->>'id','') IS NOT NULL THEN
    v_id:=(p_datos->>'id')::uuid;
    UPDATE public.sugerencias_restaurantes
       SET nombre=v_nombre,localidad=v_localidad,enlace=v_enlace,telefono=v_telefono,motivo=v_motivo,
           precio_orientativo=v_precio,actualizada_en=now()
     WHERE id=v_id AND creada_por=v_actor AND estado='en_lista' AND comida_id IS NULL
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Esta propuesta no se puede editar'; END IF;
  ELSE
    INSERT INTO public.sugerencias_restaurantes(nombre,localidad,enlace,telefono,motivo,precio_orientativo,creada_por)
    VALUES(v_nombre,v_localidad,v_enlace,v_telefono,v_motivo,v_precio,v_actor)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Ya tenemos este restaurante propuesto en esa localidad';
END $fn$;

-- El autor solo puede retirar propuestas pendientes; no borra votos ni comentarios.
CREATE OR REPLACE FUNCTION public.retirar_sugerencia_restaurante_cofrade(p_token text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_actor uuid;v_count integer;
BEGIN
  v_actor:=cofradia_privada.cofrade_sesion_historial(p_token);
  UPDATE public.sugerencias_restaurantes
     SET estado='retirado',actualizada_en=now()
   WHERE id=p_id AND creada_por=v_actor AND estado='en_lista' AND comida_id IS NULL;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN RAISE EXCEPTION 'Solo puedes eliminar tus propuestas pendientes'; END IF;
  RETURN true;
END $fn$;

CREATE OR REPLACE FUNCTION public.cambiar_interes_restaurante_cofrade(p_token text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_actor uuid;v_borrados integer;
BEGIN
  v_actor:=cofradia_privada.cofrade_sesion_historial(p_token);
  IF NOT EXISTS(SELECT 1 FROM public.sugerencias_restaurantes WHERE id=p_id AND estado='en_lista') THEN
    RAISE EXCEPTION 'Esta propuesta ya no acepta nuevos intereses';
  END IF;
  DELETE FROM public.intereses_sugerencias_restaurantes WHERE sugerencia_id=p_id AND cofrade_id=v_actor;
  GET DIAGNOSTICS v_borrados=ROW_COUNT;
  IF v_borrados>0 THEN RETURN false; END IF;
  INSERT INTO public.intereses_sugerencias_restaurantes(sugerencia_id,cofrade_id)
  VALUES(p_id,v_actor) ON CONFLICT DO NOTHING;
  RETURN true;
END $fn$;

CREATE OR REPLACE FUNCTION public.gestionar_comentario_restaurante_cofrade(
  p_token text,p_sugerencia uuid,p_texto text,p_comentario uuid DEFAULT NULL,p_eliminar boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_actor uuid;v_id uuid;v_texto text:=btrim(coalesce(p_texto,''));
BEGIN
  v_actor:=cofradia_privada.cofrade_sesion_historial(p_token);
  IF NOT EXISTS(SELECT 1 FROM public.sugerencias_restaurantes WHERE id=p_sugerencia AND estado='en_lista') THEN
    RAISE EXCEPTION 'Esta propuesta no admite comentarios';
  END IF;
  IF p_eliminar THEN
    DELETE FROM public.comentarios_sugerencias_restaurantes
     WHERE id=p_comentario AND sugerencia_id=p_sugerencia AND autor_id=v_actor RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Comentario no encontrado'; END IF;
    RETURN v_id;
  END IF;
  IF char_length(v_texto) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Escribe entre 1 y 500 caracteres'; END IF;
  IF p_comentario IS NULL THEN
    INSERT INTO public.comentarios_sugerencias_restaurantes(sugerencia_id,autor_id,texto)
    VALUES(p_sugerencia,v_actor,v_texto) RETURNING id INTO v_id;
  ELSE
    UPDATE public.comentarios_sugerencias_restaurantes
       SET texto=v_texto,actualizado_en=now()
     WHERE id=p_comentario AND sugerencia_id=p_sugerencia AND autor_id=v_actor
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Solo puedes modificar tus comentarios'; END IF;
  END IF;
  RETURN v_id;
END $fn$;

-- Operaciones de administración: requieren sesión Supabase y el segundo factor configurado.
CREATE OR REPLACE FUNCTION public.listar_sugerencias_restaurantes_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NOT cofradia_privada.es_admin() THEN RAISE EXCEPTION 'Acceso restringido' USING errcode='42501'; END IF;
  RETURN jsonb_build_object(
    'propuestas',cofradia_privada.resumen_sugerencias_restaurantes(NULL,true),
    'comidas',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',m.id,'nombre',r.nombre,'fecha',m.fecha,'codigo',m.codigo_origen
    ) ORDER BY m.fecha DESC)
    FROM public.comidas m JOIN public.restaurantes r ON r.id=m.restaurante_id
    WHERE m.publicada=true AND m.fecha<=current_date),'[]'::jsonb)
  );
END $fn$;

CREATE OR REPLACE FUNCTION public.editar_sugerencia_restaurante_admin(p_id uuid,p_datos jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_nombre text:=btrim(coalesce(p_datos->>'nombre',''));
  v_localidad text:=btrim(coalesce(p_datos->>'localidad',''));
  v_enlace text:=btrim(coalesce(p_datos->>'enlace',''));
  v_telefono text:=btrim(coalesce(p_datos->>'telefono',''));
  v_motivo text:=btrim(coalesce(p_datos->>'motivo',''));
  v_precio numeric;v_count integer;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN RAISE EXCEPTION 'Acceso restringido' USING errcode='42501'; END IF;
  IF char_length(v_nombre) NOT BETWEEN 3 AND 120 OR char_length(v_localidad) NOT BETWEEN 2 AND 100
    OR char_length(v_motivo)>600 OR char_length(v_enlace)>500 OR char_length(v_telefono)>40
    OR (v_enlace<>'' AND v_enlace !~* '^https?://') THEN
    RAISE EXCEPTION 'Revisa los datos de la propuesta';
  END IF;
  IF coalesce(btrim(p_datos->>'precio_orientativo'),'')<>'' THEN
    v_precio:=(p_datos->>'precio_orientativo')::numeric;
    IF v_precio NOT BETWEEN 0 AND 2000 THEN RAISE EXCEPTION 'Precio no válido'; END IF;
  END IF;
  UPDATE public.sugerencias_restaurantes SET
    nombre=v_nombre,localidad=v_localidad,enlace=v_enlace,telefono=v_telefono,motivo=v_motivo,
    precio_orientativo=v_precio,actualizada_en=now() WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Ese restaurante ya está propuesto en la misma localidad';
END $fn$;

CREATE OR REPLACE FUNCTION public.estado_sugerencia_restaurante_admin(
  p_id uuid,p_estado text,p_comida uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_count integer;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN RAISE EXCEPTION 'Acceso restringido' USING errcode='42501'; END IF;
  IF p_estado NOT IN ('en_lista','visitado','descartado','retirado') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  IF p_estado='visitado' AND NOT EXISTS (
    SELECT 1 FROM public.comidas WHERE id=p_comida AND publicada=true AND fecha<=current_date
  ) THEN
    RAISE EXCEPTION 'Selecciona una comida ya celebrada y publicada';
  END IF;
  UPDATE public.sugerencias_restaurantes
     SET estado=p_estado,comida_id=CASE WHEN p_estado='visitado' THEN p_comida ELSE NULL END,
         actualizada_en=now()
   WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Ya existe esa propuesta en la lista';
END $fn$;

CREATE OR REPLACE FUNCTION public.eliminar_comentario_restaurante_admin(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_count integer;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN RAISE EXCEPTION 'Acceso restringido' USING errcode='42501'; END IF;
  DELETE FROM public.comentarios_sugerencias_restaurantes WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count=1;
END $fn$;

-- Borrado irreversible exclusivo del administrador. Las relaciones de intereses y
-- comentarios se eliminan por CASCADE, pero nunca se toca una comida oficial.
CREATE OR REPLACE FUNCTION public.eliminar_sugerencia_restaurante_admin(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_count integer;
BEGIN
  IF NOT cofradia_privada.es_admin() THEN RAISE EXCEPTION 'Acceso restringido' USING errcode='42501'; END IF;
  DELETE FROM public.sugerencias_restaurantes
   WHERE id=p_id AND estado<>'visitado' AND comida_id IS NULL;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  IF v_count<>1 THEN
    RAISE EXCEPTION 'No se puede borrar esta propuesta: no existe o está vinculada a una comida';
  END IF;
  RETURN true;
END $fn$;

REVOKE ALL ON FUNCTION public.listar_sugerencias_restaurantes_cofrade(text),
  public.guardar_sugerencia_restaurante_cofrade(text,jsonb),
  public.retirar_sugerencia_restaurante_cofrade(text,uuid),
  public.cambiar_interes_restaurante_cofrade(text,uuid),
  public.gestionar_comentario_restaurante_cofrade(text,uuid,text,uuid,boolean),
  public.listar_sugerencias_restaurantes_admin(),
  public.editar_sugerencia_restaurante_admin(uuid,jsonb),
  public.estado_sugerencia_restaurante_admin(uuid,text,uuid),
  public.eliminar_comentario_restaurante_admin(uuid),
  public.eliminar_sugerencia_restaurante_admin(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_sugerencias_restaurantes_cofrade(text),
  public.guardar_sugerencia_restaurante_cofrade(text,jsonb),
  public.retirar_sugerencia_restaurante_cofrade(text,uuid),
  public.cambiar_interes_restaurante_cofrade(text,uuid),
  public.gestionar_comentario_restaurante_cofrade(text,uuid,text,uuid,boolean)
  TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.listar_sugerencias_restaurantes_admin(),
  public.editar_sugerencia_restaurante_admin(uuid,jsonb),
  public.estado_sugerencia_restaurante_admin(uuid,text,uuid),
  public.eliminar_comentario_restaurante_admin(uuid),
  public.eliminar_sugerencia_restaurante_admin(uuid)
  TO authenticated;
