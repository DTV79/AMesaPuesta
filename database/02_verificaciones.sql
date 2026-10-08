-- Verificaciones genéricas SIN datos personales ni importes históricos
select 'cofrades' tabla,count(*) registros from public.cofrades
union all select 'restaurantes',count(*) from public.restaurantes
union all select 'comidas',count(*) from public.comidas
union all select 'asistencias',count(*) from public.asistencias
union all select 'invitados_comida',count(*) from public.invitados_comida
union all select 'organizadores_comida',count(*) from public.organizadores_comida
union all select 'pagos_cuotas',count(*) from public.pagos_cuotas
union all select 'cargos_bote',count(*) from public.cargos_bote
union all select 'gastos_adicionales_comida',count(*) from public.gastos_adicionales_comida
union all select 'fotos_comida',count(*) from public.fotos_comida;

-- Seguridad RLS y restricciones por rol
select schemaname, tablename, rowsecurity
from pg_tables where schemaname='public' order by tablename;

select 'cuotas' control, has_table_privilege('anon','public.pagos_cuotas','SELECT') anon_lectura,
  has_table_privilege('authenticated','public.pagos_cuotas','SELECT') usuario_lectura
union all select 'cofrades', has_table_privilege('anon','public.cofrades','SELECT'),
  has_table_privilege('authenticated','public.cofrades','SELECT');

-- Resumen agregado monetario (no registra ni publica identidades personales)
select
 (select sum(importe) from public.pagos_cuotas) cuotas_ingresadas,
 (select sum(importe) from public.cargos_bote) cargos_historicos,
 (select sum(importe) from public.pagos_cuotas) -
 (select sum(importe) from public.cargos_bote) saldo_conjunto;

-- Se distingue claramente el número de cofrades asistentes e invitados.
select m.codigo_origen,
 (select count(*) from public.asistencias a where a.comida_id=m.id and a.estado='si') cofrades_asistentes,
 (select count(*) from public.invitados_comida i where i.comida_id=m.id and i.estado='si') invitados
from public.comidas m order by m.codigo_origen;
