-- Fotografías aportadas por los asistentes a comidas ya celebradas.
-- Solo la Edge Function privada invoca estas funciones; los navegadores no
-- reciben permisos de escritura sobre Storage ni las tablas.

ALTER TABLE public.fotos_comida
  ADD COLUMN IF NOT EXISTS subida_por uuid REFERENCES public.cofrades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fotos_comida_subida_por_idx
  ON public.fotos_comida(comida_id,subida_por) WHERE subida_por IS NOT NULL;

CREATE OR REPLACE FUNCTION public.comidas_fotos_habilitadas_cofrade(p_token text)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_cofrade uuid;
BEGIN
  v_cofrade:=cofradia_privada.cofrade_sesion_historial(p_token);
  RETURN COALESCE((
    SELECT array_agg(c.codigo_origen ORDER BY c.fecha DESC)
      FROM public.comidas c
      JOIN public.asistencias a ON a.comida_id=c.id AND a.cofrade_id=v_cofrade AND a.estado='si'
     WHERE c.publicada=true AND c.estado='celebrada' AND c.fecha<=current_date
       AND (SELECT count(*) FROM public.fotos_comida f
             WHERE f.comida_id=c.id AND f.subida_por=v_cofrade)<30
  ),ARRAY[]::text[]);
END $fn$;

CREATE OR REPLACE FUNCTION public.autorizar_foto_comida_cofrade(p_token text,p_codigo text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_cofrade uuid;v_comida uuid;
BEGIN
  v_cofrade:=cofradia_privada.cofrade_sesion_historial(p_token);
  SELECT c.id INTO v_comida
    FROM public.comidas c
    JOIN public.asistencias a ON a.comida_id=c.id AND a.cofrade_id=v_cofrade AND a.estado='si'
   WHERE c.codigo_origen=p_codigo AND c.publicada=true AND c.estado='celebrada'
     AND c.fecha<=current_date;
  IF v_comida IS NULL THEN
    RAISE EXCEPTION 'Solo pueden añadir fotos quienes asistieron a una comida celebrada y publicada'
      USING errcode='42501';
  END IF;
  IF (SELECT count(*) FROM public.fotos_comida f
        WHERE f.comida_id=v_comida AND f.subida_por=v_cofrade)>=30 THEN
    RAISE EXCEPTION 'Has alcanzado el límite de 30 fotos para esta comida';
  END IF;
  RETURN v_comida;
END $fn$;

CREATE OR REPLACE FUNCTION public.registrar_foto_comida_cofrade(
  p_token text,p_codigo text,p_ruta text,p_titulo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_cofrade uuid;v_comida uuid;v_foto uuid;
BEGIN
  v_comida:=public.autorizar_foto_comida_cofrade(p_token,p_codigo);
  v_cofrade:=cofradia_privada.cofrade_sesion_historial(p_token);
  IF p_ruta IS NULL OR p_ruta !~ ('^'||v_comida::text||'/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|png|webp)$') THEN
    RAISE EXCEPTION 'Ruta de fotografía no válida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='comidas' AND o.name=p_ruta) THEN
    RAISE EXCEPTION 'El archivo no se ha recibido todavía';
  END IF;
  INSERT INTO public.fotos_comida(comida_id,ruta_archivo,titulo,orden,visible,portada,subida_por)
  VALUES(v_comida,p_ruta,nullif(left(btrim(coalesce(p_titulo,'')),150),''),
    COALESCE((SELECT max(orden)+1 FROM public.fotos_comida WHERE comida_id=v_comida),1),
    true,false,v_cofrade)
  RETURNING id INTO v_foto;
  RETURN v_foto;
END $fn$;

REVOKE ALL ON FUNCTION public.comidas_fotos_habilitadas_cofrade(text),
  public.autorizar_foto_comida_cofrade(text,text),
  public.registrar_foto_comida_cofrade(text,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.comidas_fotos_habilitadas_cofrade(text),
  public.autorizar_foto_comida_cofrade(text,text),
  public.registrar_foto_comida_cofrade(text,text,text,text)
  TO service_role;
