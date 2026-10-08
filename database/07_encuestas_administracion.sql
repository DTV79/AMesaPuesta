-- Cofradía A Mesa Puesta · Encuestas (fase de preparación, sin importar votos).
-- No modifica las encuestas de Google Apps Script ni las tablas históricas.
-- Los datos de administración solo se exponen a usuarios autorizados mediante RPC.

create schema if not exists cofradia_privada;
revoke all on schema cofradia_privada from public, anon;
grant usage on schema cofradia_privada to authenticated;

create table if not exists public.administradores_cofradia (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table public.administradores_cofradia enable row level security;
revoke all on public.administradores_cofradia from public, anon, authenticated;

create or replace function cofradia_privada.es_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null
     and exists(select 1 from public.administradores_cofradia
                where usuario_id = auth.uid() and activo)
$$;
revoke all on function cofradia_privada.es_admin() from public, anon;
grant execute on function cofradia_privada.es_admin() to authenticated;

create or replace function public.soy_admin_cofradia()
returns boolean language sql stable security invoker set search_path = ''
as $$ select cofradia_privada.es_admin() $$;
revoke all on function public.soy_admin_cofradia() from public, anon;
grant execute on function public.soy_admin_cofradia() to authenticated;

create table if not exists public.encuestas_cofradia (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 4 and 180),
  descripcion text not null default '' check (length(descripcion) <= 2000),
  tipo text not null default 'secreta' check (tipo in ('publica','secreta','participacion')),
  estado text not null default 'borrador' check (estado in ('borrador','programada','abierta','pausada','cerrada','archivada')),
  abre_en timestamptz,
  cierra_en timestamptz,
  cerrada_en timestamptz,
  max_opciones smallint not null default 1 check (max_opciones between 1 and 20),
  electores text not null default 'todos' check (electores in ('todos','cofrades')),
  mostrar_resultados boolean not null default true,
  mostrar_ganador boolean not null default true,
  id_legacy text unique,
  creada_por uuid references auth.users(id) on delete set null,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  constraint encuestas_fechas_validas check (abre_en is null or cierra_en is null or cierra_en > abre_en)
);
create index if not exists encuestas_cofradia_estado_idx on public.encuestas_cofradia(estado,creada_en desc);

create table if not exists public.encuesta_opciones_cofradia (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.encuestas_cofradia(id) on delete cascade,
  texto text not null check (length(btrim(texto)) between 1 and 180),
  posicion smallint not null check (posicion between 1 and 20),
  votos integer not null default 0 check (votos >= 0),
  unique (encuesta_id,posicion),
  unique (id,encuesta_id)
);
create index if not exists encuesta_opciones_cofradia_encuesta_idx on public.encuesta_opciones_cofradia(encuesta_id,posicion);

create table if not exists public.encuesta_participaciones_cofradia (
  encuesta_id uuid not null references public.encuestas_cofradia(id) on delete restrict,
  cofrade_id uuid not null references public.cofrades(id) on delete restrict,
  registrada_en timestamptz not null default now(),
  primary key (encuesta_id,cofrade_id)
);

-- Solo las encuestas públicas conservan la relación opción-votante.
-- En secretas/participación visible únicamente quedan contadores por opción
-- y la lista separada de participantes, sin papeleta vinculada al votante.
create table if not exists cofradia_privada.votos_publicos (
  encuesta_id uuid not null,
  cofrade_id uuid not null,
  opcion_id uuid not null,
  primary key (encuesta_id,cofrade_id,opcion_id),
  foreign key (encuesta_id,cofrade_id)
    references public.encuesta_participaciones_cofradia(encuesta_id,cofrade_id) on delete restrict,
  foreign key (opcion_id,encuesta_id)
    references public.encuesta_opciones_cofradia(id,encuesta_id) on delete restrict
);
revoke all on cofradia_privada.votos_publicos from public, anon, authenticated;

alter table public.encuestas_cofradia enable row level security;
alter table public.encuesta_opciones_cofradia enable row level security;
alter table public.encuesta_participaciones_cofradia enable row level security;
alter table cofradia_privada.votos_publicos enable row level security;

-- Las tablas no son API pública; incluso el administrador usa RPC específicas.
revoke all on public.encuestas_cofradia from public, anon, authenticated;
revoke all on public.encuesta_opciones_cofradia from public, anon, authenticated;
revoke all on public.encuesta_participaciones_cofradia from public, anon, authenticated;

-- Listado administrativo sin exponer identidades ni votos individuales.
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
      'abre_en',e.abre_en,'cierra_en',e.cierra_en,'cerrada_en',e.cerrada_en,
      'max_opciones',e.max_opciones,'electores',e.electores,
      'mostrar_resultados',e.mostrar_resultados,'mostrar_ganador',e.mostrar_ganador,
      'id_legacy',e.id_legacy,'creada_en',e.creada_en,
      'participantes',(select count(*) from public.encuesta_participaciones_cofradia p where p.encuesta_id=e.id),
      'opciones',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'texto',o.texto,'votos',o.votos,'posicion',o.posicion) order by o.posicion)
                            from public.encuesta_opciones_cofradia o where o.encuesta_id=e.id),'[]'::jsonb)
    ) order by e.creada_en desc),'[]'::jsonb)
    into resultado
  from public.encuestas_cofradia e;
  return resultado;
end $$;
revoke all on function public.listar_encuestas_admin() from public, anon;
grant execute on function public.listar_encuestas_admin() to authenticated;

-- Crear/editar encuesta y opciones de forma atómica, con reglas de inmutabilidad
-- si ya hay votos. Una edición jamás borra resultados registrados.
create or replace function public.guardar_encuesta_admin(p_encuesta jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_titulo text := btrim(coalesce(p_encuesta->>'titulo',''));
  v_descripcion text := coalesce(p_encuesta->>'descripcion','');
  v_tipo text := coalesce(p_encuesta->>'tipo','secreta');
  v_estado text := coalesce(p_encuesta->>'estado','borrador');
  v_electores text := coalesce(p_encuesta->>'electores','todos');
  v_max int := coalesce(nullif(p_encuesta->>'max_opciones','')::integer,1);
  v_inicio timestamptz := nullif(p_encuesta->>'abre_en','')::timestamptz;
  v_fin timestamptz := nullif(p_encuesta->>'cierra_en','')::timestamptz;
  v_resultados boolean := coalesce((p_encuesta->>'mostrar_resultados')::boolean,true);
  v_ganador boolean := coalesce((p_encuesta->>'mostrar_ganador')::boolean,true);
  v_opciones text[];
  v_prev public.encuestas_cofradia%rowtype;
  v_con_votos boolean := false;
  v_opciones_prev text[];
  v_opcion text;
  v_pos int := 0;
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode = '42501';
  end if;
  if p_encuesta is null or jsonb_typeof(p_encuesta) <> 'object'
     or jsonb_typeof(p_encuesta->'opciones') <> 'array' then
    raise exception 'Formato de encuesta no válido';
  end if;
  select array_agg(btrim(value) order by ord) into v_opciones
  from jsonb_array_elements_text(p_encuesta->'opciones') with ordinality as t(value,ord);
  if length(v_titulo) not between 4 and 180 or length(v_descripcion)>2000
     or v_tipo not in ('publica','secreta','participacion')
     or v_estado not in ('borrador','programada','abierta','pausada','cerrada','archivada')
     or v_electores not in ('todos','cofrades')
     or v_max not between 1 and 20
     or coalesce(array_length(v_opciones,1),0) not between 2 and 20
     or v_max > array_length(v_opciones,1)
     or (v_inicio is not null and v_fin is not null and v_fin<=v_inicio)
     or exists(select 1 from unnest(v_opciones) t where length(t) not between 1 and 180)
     or (select count(distinct lower(t)) from unnest(v_opciones) t) <> array_length(v_opciones,1)
  then raise exception 'Revisa título, fechas, tipo y opciones (entre 2 y 20, sin duplicados)';
  end if;
  if v_estado = 'programada' and v_inicio is null then
    raise exception 'Una encuesta programada necesita fecha de apertura';
  end if;
  if nullif(p_encuesta->>'id','') is not null then
    v_id := (p_encuesta->>'id')::uuid;
    select * into v_prev from public.encuestas_cofradia where id=v_id for update;
    if not found then raise exception 'Encuesta no encontrada'; end if;
    select exists(select 1 from public.encuesta_participaciones_cofradia where encuesta_id=v_id) into v_con_votos;
    select array_agg(texto order by posicion) into v_opciones_prev
    from public.encuesta_opciones_cofradia where encuesta_id=v_id;
    if v_con_votos and (
      v_prev.tipo<>v_tipo or v_prev.electores<>v_electores
      or v_prev.max_opciones<>v_max or v_opciones_prev is distinct from v_opciones
      or v_prev.abre_en is distinct from v_inicio
      or v_prev.estado in ('cerrada','archivada') and v_estado not in ('cerrada','archivada')
    ) then
      raise exception 'No se pueden alterar las reglas ni las opciones de una encuesta con votos';
    end if;
    update public.encuestas_cofradia
      set titulo=v_titulo, descripcion=v_descripcion, tipo=v_tipo, estado=v_estado,
          abre_en=v_inicio, cierra_en=v_fin,
          cerrada_en=case when v_estado in ('cerrada','archivada') then coalesce(cerrada_en,now()) else null end,
          max_opciones=v_max, electores=v_electores,
          mostrar_resultados=v_resultados, mostrar_ganador=v_ganador, actualizada_en=now()
      where id=v_id;
    if not v_con_votos and v_opciones_prev is distinct from v_opciones then
      delete from public.encuesta_opciones_cofradia where encuesta_id=v_id;
    else
      return v_id;
    end if;
  else
    insert into public.encuestas_cofradia
      (titulo,descripcion,tipo,estado,abre_en,cierra_en,cerrada_en,max_opciones,electores,
       mostrar_resultados,mostrar_ganador,creada_por)
    values
      (v_titulo,v_descripcion,v_tipo,v_estado,v_inicio,v_fin,
       case when v_estado in ('cerrada','archivada') then now() else null end,
       v_max,v_electores,v_resultados,v_ganador,auth.uid())
    returning id into v_id;
  end if;
  foreach v_opcion in array v_opciones loop
    v_pos := v_pos + 1;
    insert into public.encuesta_opciones_cofradia(encuesta_id,texto,posicion)
    values(v_id,v_opcion,v_pos);
  end loop;
  return v_id;
end $$;
revoke all on function public.guardar_encuesta_admin(jsonb) from public, anon;
grant execute on function public.guardar_encuesta_admin(jsonb) to authenticated;

create or replace function public.eliminar_encuesta_admin(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_estado text;
begin
  if not cofradia_privada.es_admin() then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;
  select estado into v_estado from public.encuestas_cofradia where id=p_id for update;
  if not found then return false; end if;
  if v_estado<>'borrador' or exists(select 1 from public.encuesta_participaciones_cofradia where encuesta_id=p_id) then
    raise exception 'Solo se pueden eliminar borradores sin votos';
  end if;
  delete from public.encuestas_cofradia where id=p_id;
  return true;
end $$;
revoke all on function public.eliminar_encuesta_admin(uuid) from public, anon;
grant execute on function public.eliminar_encuesta_admin(uuid) to authenticated;

-- Voto autenticado: el usuario debe estar vinculado a un cofrade activo.
-- Un voto por cofrade/encuesta, validación de elegibilidad y opciones.
-- Solo en modo "publica" se registra el vínculo entre identidad y opción.
create or replace function public.votar_encuesta_cofradia(p_id uuid,p_opciones uuid[])
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_encuesta public.encuestas_cofradia%rowtype;
  v_cofrade public.cofrades%rowtype;
  v_cantidad int := coalesce(array_length(p_opciones,1),0);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión' using errcode='42501'; end if;
  select * into v_cofrade from public.cofrades
    where usuario_auth_id=auth.uid() and fecha_baja is null;
  if not found then raise exception 'Tu cuenta no está vinculada a un cofrade activo' using errcode='42501'; end if;
  select * into v_encuesta from public.encuestas_cofradia where id=p_id for update;
  if not found then raise exception 'Encuesta no encontrada'; end if;
  if v_encuesta.estado not in ('abierta','programada')
    or (v_encuesta.abre_en is not null and now()<v_encuesta.abre_en)
    or (v_encuesta.cierra_en is not null and now()>v_encuesta.cierra_en) then
    raise exception 'La encuesta no admite votos';
  end if;
  if v_encuesta.electores='cofrades'
    and lower(coalesce(v_cofrade.categoria_excel,'')) not in ('cofrade','cofrade fundador') then
    raise exception 'Esta encuesta es solo para cofrades' using errcode='42501';
  end if;
  if v_cantidad<1 or v_cantidad>v_encuesta.max_opciones
    or (select count(distinct x) from unnest(p_opciones) x)<>v_cantidad
    or (select count(*) from public.encuesta_opciones_cofradia where encuesta_id=p_id and id=any(p_opciones))<>v_cantidad
  then raise exception 'Opciones de voto no válidas'; end if;
  insert into public.encuesta_participaciones_cofradia(encuesta_id,cofrade_id)
    values(p_id,v_cofrade.id);
  update public.encuesta_opciones_cofradia set votos=votos+1
    where encuesta_id=p_id and id=any(p_opciones);
  if v_encuesta.tipo='publica' then
    insert into cofradia_privada.votos_publicos(encuesta_id,cofrade_id,opcion_id)
      select p_id,v_cofrade.id,unnest(p_opciones);
  end if;
  return true;
exception
  when unique_violation then
    raise exception 'Ya has votado en esta encuesta';
end $$;
revoke all on function public.votar_encuesta_cofradia(uuid,uuid[]) from public, anon;
grant execute on function public.votar_encuesta_cofradia(uuid,uuid[]) to authenticated;

comment on table public.encuestas_cofradia is 'Borradores y encuestas Cofradía; las encuestas heredadas de Google no se han importado.';
comment on table public.encuesta_participaciones_cofradia is 'Control de voto único por cofrade; no registra elecciones secretas.';
comment on table cofradia_privada.votos_publicos is 'Solo encuestas de tipo publica; las secretas y participacion no vinculan elección a identidad.';
