-- API de lectura de encuestas para la futura migración desde Google Apps Script.
-- Compatible con el formato consumido por docs/v2/encuestas.js.
-- Sin cambios en la web pública ni en los datos de Google.

create or replace function public.listar_encuestas_cofradia()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  p public.encuestas_cofradia%rowtype;
  v_estado text;
  v_cierre timestamptz;
  v_resultados boolean;
  v_opciones jsonb;
  v_ganadores jsonb;
  v_ganador jsonb;
  v_participantes jsonb;
  v_cofrades jsonb;
  v_encuestas jsonb := '[]'::jsonb;
  v_total integer;
  v_participaron integer;
  v_elegibles integer;
  v_max integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',c.id::text,'nombre',c.nombre,'rango',lower(coalesce(c.categoria_excel,'cofrade'))
    ) order by c.nombre),'[]'::jsonb)
  into v_cofrades
  from public.cofrades c where c.fecha_baja is null;

  for p in
    select e.* from public.encuestas_cofradia e
    where e.estado in ('abierta','programada','cerrada','archivada')
      and (e.estado not in ('abierta','programada')
           or e.abre_en is null or e.abre_en<=now())
    order by e.creada_en desc,e.id
  loop
    v_estado := case
      when p.estado in ('cerrada','archivada') or (p.cierra_en is not null and now()>=p.cierra_en)
        then 'cerrada'
      else 'abierta' end;
    v_cierre := case
      when p.estado in ('cerrada','archivada')
        then coalesce(p.cerrada_en,p.cierra_en,p.actualizada_en)
      when v_estado='cerrada' then p.cierra_en
      else null end;

    -- No se revelan resultados ni ganadores de votaciones secretas
    -- o de participación visible antes del cierre.
    v_resultados := p.mostrar_resultados
      and (v_estado='cerrada' or p.tipo='publica');

    select count(*) into v_participaron
    from public.encuesta_participaciones_cofradia x where x.encuesta_id=p.id;

    select count(*) into v_elegibles from public.cofrades c
    where c.fecha_baja is null and
      (p.electores='todos' or lower(coalesce(c.categoria_excel,'')) in ('cofrade','cofrade fundador'));

    select coalesce(sum(o.votos),0),coalesce(max(o.votos),0)
    into v_total,v_max
    from public.encuesta_opciones_cofradia o where o.encuesta_id=p.id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'name',o.texto,
      'votes',case when v_resultados then o.votos else 0 end,
      'voters',case
        when p.tipo='publica' and v_resultados then
          coalesce((select jsonb_agg(c.nombre order by c.nombre)
            from cofradia_privada.votos_publicos v
            join public.cofrades c on c.id=v.cofrade_id
            where v.encuesta_id=p.id and v.opcion_id=o.id),'[]'::jsonb)
        else '[]'::jsonb end
      ) order by o.posicion),'[]'::jsonb)
    into v_opciones
    from public.encuesta_opciones_cofradia o where o.encuesta_id=p.id;

    if p.tipo='secreta' then
      v_participantes := '[]'::jsonb;
    else
      select coalesce(jsonb_agg(c.nombre order by c.nombre),'[]'::jsonb)
      into v_participantes
      from public.encuesta_participaciones_cofradia x
      join public.cofrades c on c.id=x.cofrade_id
      where x.encuesta_id=p.id;
    end if;

    v_ganadores := '[]'::jsonb;
    v_ganador := null;
    if v_resultados and v_max>0 then
      select coalesce(jsonb_agg(jsonb_build_object('name',o.texto,'votes',o.votos)
        order by o.posicion),'[]'::jsonb)
      into v_ganadores
      from public.encuesta_opciones_cofradia o
      where o.encuesta_id=p.id and o.votos=v_max;
      v_ganador := v_ganadores->0;
    end if;

    v_encuestas := v_encuestas || jsonb_build_array(jsonb_build_object(
      'id',p.id::text,'title',p.titulo,'description',p.descripcion,
      'type',p.tipo,'status',v_estado,
      'closes',case when p.cierra_en is not null then to_char(p.cierra_en at time zone 'Europe/Madrid','YYYY-MM-DD HH24:MI') else '' end,
      'closedAt',case when v_cierre is not null then to_char(v_cierre at time zone 'Europe/Madrid','YYYY-MM-DD HH24:MI') else '' end,
      'closedByDate',p.cierra_en is not null and now()>=p.cierra_en and p.estado not in ('cerrada','archivada'),
      'closedByParticipation',false,
      'isRecentlyClosed',v_estado='cerrada' and v_cierre>=now()-interval '5 days',
      'countdownText','',
      'showResults',p.mostrar_resultados,'showWinner',p.mostrar_ganador,
      'maxChoices',p.max_opciones,'votersMode',p.electores,
      'totalVotes',case when v_resultados then v_total else 0 end,
      'eligibleVotersCount',v_elegibles,
      'votedEligibleCount',v_participaron,
      'votedMembers',v_participantes,
      'options',v_opciones,
      'winner',v_ganador,
      'winners',v_ganadores,
      'isTie',jsonb_array_length(v_ganadores)>1
    ));
  end loop;

  return jsonb_build_object('polls',v_encuestas,'cofrades',v_cofrades);
end $$;
revoke all on function public.listar_encuestas_cofradia() from public, anon, authenticated;
grant execute on function public.listar_encuestas_cofradia() to anon,authenticated;

-- El usuario autenticado conoce solo su propio perfil y sus encuestas votadas.
create or replace function public.mi_identidad_encuestas_cofradia()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c public.cofrades%rowtype;
  votadas jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión' using errcode='42501';
  end if;
  select * into c from public.cofrades
  where usuario_auth_id=auth.uid() and fecha_baja is null;
  if not found then
    return jsonb_build_object('vinculado',false,'votadas','[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(x.encuesta_id::text),'[]'::jsonb)
  into votadas from public.encuesta_participaciones_cofradia x
  where x.cofrade_id=c.id;
  return jsonb_build_object(
    'vinculado',true,'id',c.id,'nombre',c.nombre,
    'categoria',c.categoria_excel,'votadas',votadas);
end $$;
revoke all on function public.mi_identidad_encuestas_cofradia() from public, anon;
grant execute on function public.mi_identidad_encuestas_cofradia() to authenticated;

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
