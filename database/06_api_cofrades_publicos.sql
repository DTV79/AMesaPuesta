-- Lectura publica LIMITADA para las fichas historicas de Cofrades en la web V2.
-- No exponer pagos, cuotas, gastos, deuda, remanente ni importe individual alguno.
-- Solo se computan asistencias y organizaciones de comidas celebradas PUBLICADAS.
begin;

create or replace function public.listar_cofrades_publicos()
returns table(
  nombre text,
  categoria text,
  fecha_ingreso date,
  fecha_baja date,
  fundador boolean,
  comidas_asistidas bigint,
  comidas_organizadas bigint
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select
    c.nombre,
    c.categoria_excel,
    c.fecha_ingreso,
    c.fecha_baja,
    c.fundador_marcado_excel,
    (
      select count(distinct a.comida_id)
      from public.asistencias a
      join public.comidas m on m.id = a.comida_id
      where a.cofrade_id = c.id
        and a.estado = 'si'
        and m.estado = 'celebrada'
        and m.publicada = true
    ) as comidas_asistidas,
    (
      select count(distinct o.comida_id)
      from public.organizadores_comida o
      join public.comidas m on m.id = o.comida_id
      where o.cofrade_id = c.id
        and m.estado = 'celebrada'
        and m.publicada = true
    ) as comidas_organizadas
  from public.cofrades c
  order by c.nombre;
$fn$;

revoke all on function public.listar_cofrades_publicos()
  from PUBLIC, anon, authenticated;
grant execute on function public.listar_cofrades_publicos() to anon, authenticated;

comment on function public.listar_cofrades_publicos() is
  'Solo miembros, categoria, altas/bajas y estadisticas historicas publicas. Sin datos economicos ni personales adicionales.';

commit;