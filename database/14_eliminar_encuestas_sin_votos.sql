-- Permite eliminar cualquier encuesta que todavía no tenga participaciones.
-- Una encuesta con votos se conserva para proteger el histórico.
create or replace function public.eliminar_encuesta_admin(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;

  perform 1 from public.encuestas_cofradia where id=p_id for update;
  if not found then return false; end if;

  if exists(
    select 1 from public.encuesta_participaciones_cofradia
    where encuesta_id=p_id
  ) then
    raise exception 'No se puede eliminar una encuesta que ya tiene votos. Archívala para conservar el histórico.';
  end if;

  delete from public.encuestas_cofradia where id=p_id;
  return true;
end $$;

revoke all on function public.eliminar_encuesta_admin(uuid) from public, anon;
grant execute on function public.eliminar_encuesta_admin(uuid) to authenticated;
