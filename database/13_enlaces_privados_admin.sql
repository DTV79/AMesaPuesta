-- Enlaces privados de alta de administrador.
-- El token se entrega una sola vez y en la base solo se guarda su SHA-256.
alter table public.invitaciones_admin_cofradia
  add column if not exists token_hash text,
  add column if not exists expira_en timestamptz;

create or replace function cofradia_privada.nuevo_token_admin(p_id uuid)
returns text language plpgsql volatile security definer set search_path=''
as $$
declare v_token text;
begin
  v_token:=encode(extensions.gen_random_bytes(32),'hex');
  update public.invitaciones_admin_cofradia
  set token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),
      expira_en=now()+interval '7 days',
      estado='pendiente',revocado_en=null
  where id=p_id;
  if not found then raise exception 'Invitación no encontrada'; end if;
  return v_token;
end $$;
revoke all on function cofradia_privada.nuevo_token_admin(uuid) from public,anon,authenticated;

create or replace function public.autorizar_administrador_cofradia(p_email text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_email text:=lower(btrim(coalesce(p_email,'')));
  v_user auth.users%rowtype;
  v_id uuid;
  v_token text;
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>320 then
    raise exception 'Correo electrónico no válido';
  end if;

  insert into public.invitaciones_admin_cofradia(email,estado,invitado_por,creado_en,aceptado_en,revocado_en)
  values(v_email,'pendiente',auth.uid(),now(),null,null)
  on conflict((lower(email))) do update set
    email=excluded.email,estado='pendiente',invitado_por=auth.uid(),
    creado_en=now(),aceptado_en=null,revocado_en=null
  returning id into v_id;

  select * into v_user from auth.users where lower(email)=v_email limit 1;
  if found and v_user.email_confirmed_at is not null then
    insert into public.administradores_cofradia(usuario_id,activo)
    values(v_user.id,true) on conflict(usuario_id) do update set activo=true;
    update public.invitaciones_admin_cofradia
      set estado='aceptada',aceptado_en=now(),token_hash=null,expira_en=null
      where id=v_id;
    return jsonb_build_object('estado','activado','email',v_email);
  end if;

  v_token:=cofradia_privada.nuevo_token_admin(v_id);
  return jsonb_build_object('estado','pendiente','email',v_email,'token',v_token,'expira_en',now()+interval '7 days');
end $$;
revoke all on function public.autorizar_administrador_cofradia(text) from public,anon;
grant execute on function public.autorizar_administrador_cofradia(text) to authenticated;

create or replace function public.renovar_invitacion_admin_cofradia(p_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_email text;
declare v_token text;
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;
  select email into v_email from public.invitaciones_admin_cofradia
  where id=p_id and estado='pendiente';
  if not found then raise exception 'Invitación pendiente no encontrada'; end if;
  v_token:=cofradia_privada.nuevo_token_admin(p_id);
  return jsonb_build_object('email',v_email,'token',v_token,'expira_en',now()+interval '7 days');
end $$;
revoke all on function public.renovar_invitacion_admin_cofradia(uuid) from public,anon;
grant execute on function public.renovar_invitacion_admin_cofradia(uuid) to authenticated;

-- Edge Function: valida el token sin exponer la tabla al navegador.
create or replace function public.validar_token_alta_admin(p_email text,p_token_hash text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.invitaciones_admin_cofradia i
    where lower(i.email)=lower(btrim(p_email))
      and i.estado='pendiente'
      and i.expira_en>now()
      and i.token_hash=p_token_hash
  )
$$;
revoke all on function public.validar_token_alta_admin(text,text) from public,anon,authenticated;
grant execute on function public.validar_token_alta_admin(text,text) to service_role;
