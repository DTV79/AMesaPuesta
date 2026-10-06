-- El administrador puede consultar participación, pero las elecciones secretas
-- permanecen ocultas hasta el cierre incluso para quien gestiona la encuesta.
create or replace function public.listar_encuestas_admin()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare resultado jsonb;
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',e.id,'titulo',e.titulo,'descripcion',e.descripcion,
      'tipo',e.tipo,'estado',e.estado,
      'estado_efectivo',case
        when e.estado in ('cerrada','archivada') then e.estado
        when e.estado in ('abierta','programada') and e.cierra_en is not null and now()>=e.cierra_en then 'cerrada'
        when e.estado='programada' and e.abre_en is not null and now()>=e.abre_en then 'abierta'
        else e.estado end,
      'abre_en',e.abre_en,'cierra_en',e.cierra_en,'cerrada_en',e.cerrada_en,
      'max_opciones',e.max_opciones,'electores',e.electores,
      'mostrar_resultados',e.mostrar_resultados,'mostrar_ganador',e.mostrar_ganador,
      'id_legacy',e.id_legacy,'creada_en',e.creada_en,
      'participantes',(select count(*) from public.encuesta_participaciones_cofradia p where p.encuesta_id=e.id),
      'resultados_disponibles',e.tipo='publica' or e.estado in ('cerrada','archivada')
        or (e.cierra_en is not null and now()>=e.cierra_en),
      'opciones',coalesce((select jsonb_agg(jsonb_build_object(
          'id',o.id,'texto',o.texto,
          'votos',case when e.tipo='publica' or e.estado in ('cerrada','archivada')
                         or (e.cierra_en is not null and now()>=e.cierra_en)
                       then o.votos else 0 end,
          'posicion',o.posicion
        ) order by o.posicion)
        from public.encuesta_opciones_cofradia o where o.encuesta_id=e.id),'[]'::jsonb)
    ) order by e.creada_en desc),'[]'::jsonb)
    into resultado
  from public.encuestas_cofradia e;
  return resultado;
end $$;
revoke all on function public.listar_encuestas_admin() from public, anon;
grant execute on function public.listar_encuestas_admin() to authenticated;
