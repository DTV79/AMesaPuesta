-- API de consulta publica para V2: recupera todos los datos que ya
-- aparecian en las fichas publicas de restaurantes de la version anterior.
-- No expone pagos individuales, cuotas, saldos, ni importe_pagado.
-- El precio es SOLO el importe historico total del restaurante.
-- Los participantes se agrupan por estado explicito, nunca por ausencia.
begin;

create or replace function public.listar_comidas_publicas_v2()
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
  numero_fotos integer,
  precio_total numeric,
  autor_cita text,
  organizadores text[],
  asistentes text[],
  no_asistentes text[],
  invitados text[]
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select
    c.codigo_origen,
    c.fecha,
    r.nombre,
    r.direccion,
    r.telefono,
    r.web,
    r.latitud,
    r.longitud,
    c.resena_estrellas,
    c.descripcion,
    c.menu_entrantes,
    c.menu_principales,
    c.menu_postres,
    c.menu_bebidas,
    c.carpeta_fotos_legacy,
    c.numero_fotos_legacy,
    c.importe_restaurante_total,
    c.autor_resena,
    array(
      select p.nombre
      from public.organizadores_comida o
      join public.cofrades p on p.id = o.cofrade_id
      where o.comida_id = c.id
      order by p.nombre
    ),
    array(
      select p.nombre
      from public.asistencias a
      join public.cofrades p on p.id = a.cofrade_id
      where a.comida_id = c.id and a.estado = 'si'
      order by p.nombre
    ),
    array(
      select p.nombre
      from public.asistencias a
      join public.cofrades p on p.id = a.cofrade_id
      where a.comida_id = c.id and a.estado = 'no'
      order by p.nombre
    ),
    array(
      select i.nombre
      from public.invitados_comida i
      where i.comida_id = c.id and i.estado = 'si'
      order by i.nombre
    )
  from public.comidas c
  join public.restaurantes r on r.id = c.restaurante_id
  where c.publicada = true and c.estado = 'celebrada'
  order by c.fecha desc, c.codigo_origen;
$fn$;

revoke all on function public.listar_comidas_publicas_v2()
  from PUBLIC, anon, authenticated;
grant execute on function public.listar_comidas_publicas_v2()
  to anon, authenticated;
comment on function public.listar_comidas_publicas_v2() is
  'Ficha publica de comida: precio total, cita, organizadores y personas asistentes/no asistentes, sin importes personales.';

commit;