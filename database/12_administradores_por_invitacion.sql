-- Altas de administradores por correo preautorizado.
-- Las contraseñas pertenecen exclusivamente a Supabase Auth y nunca se almacenan aquí.

create table if not exists public.invitaciones_admin_cofradia(
  id uuid primary key default gen_random_uuid(),
  email text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente','aceptada','revocada')),
  invitado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  aceptado_en timestamptz,
  revocado_en timestamptz
);
create unique index if not exists invitaciones_admin_email_unico
  on public.invitaciones_admin_cofradia(lower(email));

alter table public.invitaciones_admin_cofradia enable row level security;
revoke all on public.invitaciones_admin_cofradia from public,anon,authenticated;

create or replace function cofradia_privada.activar_admin_preautorizado()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_invitacion uuid;
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  select i.id into v_invitacion
  from public.invitaciones_admin_cofradia i
  where lower(i.email)=lower(new.email) and i.estado='pendiente'
  limit 1 for update;
  if v_invitacion is null then return new; end if;

  insert into public.administradores_cofradia(usuario_id,activo)
  values(new.id,true)
  on conflict(usuario_id) do update set activo=true;

  update public.invitaciones_admin_cofradia
  set estado='aceptada',aceptado_en=coalesce(aceptado_en,now()),revocado_en=null
  where id=v_invitacion;
  return new;
end $$;

drop trigger if exists activar_admin_preautorizado on auth.users;
create trigger activar_admin_preautorizado
after insert or update of email_confirmed_at,email on auth.users
for each row execute function cofradia_privada.activar_admin_preautorizado();

create or replace function public.listar_administradores_cofradia()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare r jsonb;
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;
  select jsonb_build_object(
    'administradores',coalesce((select jsonb_agg(jsonb_build_object(
      'usuario_id',a.usuario_id,'email',u.email,'activo',a.activo,
      'creado_en',a.creado_en,'es_actual',a.usuario_id=auth.uid()
    ) order by a.activo desc,u.email)
    from public.administradores_cofradia a join auth.users u on u.id=a.usuario_id),'[]'::jsonb),
    'invitaciones',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'email',i.email,'estado',i.estado,'creado_en',i.creado_en,
      'aceptado_en',i.aceptado_en,'revocado_en',i.revocado_en
    ) order by i.creado_en desc)
    from public.invitaciones_admin_cofradia i),'[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.listar_administradores_cofradia() from public,anon;
grant execute on function public.listar_administradores_cofradia() to authenticated;

create or replace function public.autorizar_administrador_cofradia(p_email text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_email text:=lower(btrim(coalesce(p_email,'')));
declare v_user auth.users%rowtype;
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
    creado_en=now(),aceptado_en=null,revocado_en=null;

  select * into v_user from auth.users where lower(email)=v_email limit 1;
  if found and v_user.email_confirmed_at is not null then
    insert into public.administradores_cofradia(usuario_id,activo)
    values(v_user.id,true) on conflict(usuario_id) do update set activo=true;
    update public.invitaciones_admin_cofradia
      set estado='aceptada',aceptado_en=now()
      where lower(email)=v_email;
    return jsonb_build_object('estado','activado','email',v_email);
  end if;
  return jsonb_build_object('estado','pendiente','email',v_email);
end $$;
revoke all on function public.autorizar_administrador_cofradia(text) from public,anon;
grant execute on function public.autorizar_administrador_cofradia(text) to authenticated;

create or replace function public.cancelar_invitacion_admin_cofradia(p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;
  update public.invitaciones_admin_cofradia
  set estado='revocada',revocado_en=now()
  where id=p_id and estado='pendiente';
  return found;
end $$;
revoke all on function public.cancelar_invitacion_admin_cofradia(uuid) from public,anon;
grant execute on function public.cancelar_invitacion_admin_cofradia(uuid) to authenticated;

create or replace function public.revocar_administrador_cofradia(p_usuario_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_activos integer;
declare v_email text;
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;
  select count(*) into v_activos from public.administradores_cofradia where activo;
  if v_activos<=1 then
    raise exception 'No se puede revocar el último administrador activo';
  end if;
  if not exists(select 1 from public.administradores_cofradia where usuario_id=p_usuario_id and activo) then
    raise exception 'Administrador activo no encontrado';
  end if;
  select email into v_email from auth.users where id=p_usuario_id;
  update public.administradores_cofradia set activo=false where usuario_id=p_usuario_id;
  if v_email is not null then
    update public.invitaciones_admin_cofradia set estado='revocada',revocado_en=now()
    where lower(email)=lower(v_email);
  end if;
  return true;
end $$;
revoke all on function public.revocar_administrador_cofradia(uuid) from public,anon;
grant execute on function public.revocar_administrador_cofradia(uuid) to authenticated;
