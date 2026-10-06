-- Lectura pública de restaurantes y comidas YA publicadas previamente.
-- Nunca expone asistentes, organizadores, cuotas, pagos, cargos ni costes.
-- La función no acepta filtros SQL y devuelve únicamente columnas permitidas.
begin;
update public.comidas
  set publicada=true, actualizado_en=now()
  where estado='celebrada' and codigo_origen in
  ('RES-0001','RES-0002','RES-0003','RES-0004','RES-0005',
   'RES-0006','RES-0007','RES-0008','RES-0009','RES-0010');

create or replace function public.listar_comidas_publicas()
returns table (
 codigo text,
 fecha date,
 restaurante text,
 direccion text,
 telefono text,
 web text,
 latitud numeric,
 longitud numeric,
 valoracion smallint,
 comentario text,
 menu_entrantes text,
 menu_principales text,
 menu_postres text,
 menu_bebidas text,
 carpeta_fotos text,
 numero_fotos integer
)
language sql stable security definer
set search_path = pg_catalog, pg_temp
as $fn$
 select c.codigo_origen, c.fecha, r.nombre, r.direccion, r.telefono, r.web,
        r.latitud, r.longitud, c.resena_estrellas, c.descripcion,
        c.menu_entrantes, c.menu_principales, c.menu_postres, c.menu_bebidas,
        c.carpeta_fotos_legacy, c.numero_fotos_legacy
 from public.comidas c
 join public.restaurantes r on r.id=c.restaurante_id
 where c.publicada = true and c.estado='celebrada'
 order by c.fecha desc, c.codigo_origen
$fn$;
revoke all on function public.listar_comidas_publicas() from public, anon, authenticated;
grant execute on function public.listar_comidas_publicas() to anon, authenticated;
comment on function public.listar_comidas_publicas()
is 'Versión pública limitada: solo comidas celebradas y publicadas, sin datos personales/financieros.';
commit;