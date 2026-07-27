begin;

create extension if not exists pgcrypto;

create table if not exists public.fitness_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  player_user_id uuid not null references public.player_users(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  username text not null,
  role text not null check (role in ('admin','capitana','tesorera','jugadora')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.fitness_months (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  name text not null,
  source_pdf_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_active boolean not null default false,
  ranking_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(year, month)
);

create unique index if not exists fitness_months_one_active_idx
  on public.fitness_months(is_active)
  where is_active is true;

create table if not exists public.fitness_days (
  id uuid primary key default gen_random_uuid(),
  fitness_month_id uuid not null references public.fitness_months(id) on delete cascade,
  workout_date date not null,
  category text,
  title text,
  description text,
  day_type text not null default 'workout' check (day_type in ('workout','rest','challenge','informational')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fitness_month_id, workout_date)
);

create table if not exists public.fitness_videos (
  id uuid primary key default gen_random_uuid(),
  fitness_day_id uuid not null references public.fitness_days(id) on delete cascade,
  title text not null,
  original_url text not null,
  embed_url text not null,
  video_provider text not null default 'youtube',
  source_page_url text,
  equipment text,
  duration_minutes integer,
  activity_type text not null default 'required' check (activity_type in ('required','optional','informational')),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(fitness_day_id, sort_order)
);

create table if not exists public.fitness_progress (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  fitness_video_id uuid not null references public.fitness_videos(id) on delete cascade,
  completed boolean not null default true,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, fitness_video_id)
);

create index if not exists fitness_auth_sessions_token_hash_idx on public.fitness_auth_sessions(token_hash);
create index if not exists fitness_auth_sessions_valid_idx on public.fitness_auth_sessions(expires_at) where revoked_at is null;
create index if not exists fitness_months_status_active_idx on public.fitness_months(status, is_active, year, month);
create index if not exists fitness_days_month_date_idx on public.fitness_days(fitness_month_id, workout_date);
create index if not exists fitness_videos_day_order_idx on public.fitness_videos(fitness_day_id, sort_order);
create index if not exists fitness_progress_player_idx on public.fitness_progress(player_id);
create index if not exists fitness_progress_video_idx on public.fitness_progress(fitness_video_id);

create or replace function public.fitness_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fitness_months_touch_updated_at on public.fitness_months;
create trigger fitness_months_touch_updated_at
  before update on public.fitness_months
  for each row execute function public.fitness_touch_updated_at();

drop trigger if exists fitness_days_touch_updated_at on public.fitness_days;
create trigger fitness_days_touch_updated_at
  before update on public.fitness_days
  for each row execute function public.fitness_touch_updated_at();

drop trigger if exists fitness_videos_touch_updated_at on public.fitness_videos;
create trigger fitness_videos_touch_updated_at
  before update on public.fitness_videos
  for each row execute function public.fitness_touch_updated_at();

drop trigger if exists fitness_progress_touch_updated_at on public.fitness_progress;
create trigger fitness_progress_touch_updated_at
  before update on public.fitness_progress
  for each row execute function public.fitness_touch_updated_at();

create or replace function public.fitness_session_token_from_headers()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  return nullif(coalesce(
    v_headers->>'x-gm-fitness-session',
    v_headers->>'X-GM-Fitness-Session'
  ), '');
end;
$$;

create or replace function public.fitness_current_player_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text := public.fitness_session_token_from_headers();
  v_player_id uuid;
begin
  if v_token is null then
    return null;
  end if;

  select s.player_id into v_player_id
  from public.fitness_auth_sessions s
  join public.player_users pu on pu.id = s.player_user_id
  where s.token_hash = encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
    and s.revoked_at is null
    and s.expires_at > now()
    and pu.active is true
  limit 1;

  return v_player_id;
end;
$$;

create or replace function public.fitness_current_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jwt_role text;
  v_token text;
  v_session_role text;
begin
  v_jwt_role := lower(coalesce(
    nullif(auth.jwt()->>'app_role',''),
    nullif(auth.jwt()->'app_metadata'->>'role',''),
    nullif(auth.jwt()->'user_metadata'->>'role',''),
    nullif(current_setting('request.jwt.claim.role', true),''),
    auth.role(),
    ''
  ));

  if v_jwt_role in ('service_role','admin') then
    return v_jwt_role;
  end if;

  v_token := public.fitness_session_token_from_headers();
  if v_token is not null then
    select s.role into v_session_role
    from public.fitness_auth_sessions s
    join public.player_users pu on pu.id = s.player_user_id
    where s.token_hash = encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
      and s.revoked_at is null
      and s.expires_at > now()
      and pu.active is true
    limit 1;

    if v_session_role in ('admin','capitana','tesorera','jugadora') then
      return v_session_role;
    end if;
  end if;

  return coalesce(v_jwt_role, '');
end;
$$;

create or replace function public.fitness_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fitness_current_role() in ('service_role','admin');
$$;

create or replace function public.fitness_can_read_month(p_fitness_month_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fitness_can_manage()
    or exists (
      select 1
      from public.fitness_months fm
      where fm.id = p_fitness_month_id
        and fm.status = 'published'
    );
$$;

create or replace function public.fitness_create_session(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_password_hash text;
  v_role text;
  v_token text;
  v_expires_at timestamptz := now() + interval '14 hours';
begin
  if nullif(trim(coalesce(p_username,'')), '') is null or coalesce(p_password,'') = '' then
    raise exception 'Ingresa usuario y contrasena' using errcode = '22023';
  end if;

  select
    pu.id as player_user_id,
    pu.player_id,
    pu.username,
    pu.role as user_role,
    pu.pwd_hash,
    p.apodo,
    p.nombre,
    p.numero_camiseta,
    p.foto,
    p.rol::text as player_role
  into v_user
  from public.player_users pu
  left join public.players p on p.id = pu.player_id
  where lower(pu.username) = lower(trim(p_username))
    and pu.active is true
  limit 1;

  if v_user.player_user_id is null then
    raise exception 'Usuario no encontrado' using errcode = '42501';
  end if;

  v_password_hash := encode(extensions.digest(convert_to(p_password, 'UTF8'), 'sha256'), 'hex');
  if coalesce(v_user.pwd_hash, '') <> v_password_hash then
    raise exception 'Usuario o contrasena incorrectos' using errcode = '42501';
  end if;

  v_role := case
    when lower(coalesce(v_user.user_role,'')) in ('admin','capitana','tesorera','jugadora') then lower(v_user.user_role)
    when lower(coalesce(v_user.player_role,'')) in ('admin','capitana','tesorera','jugadora') then lower(v_user.player_role)
    else 'jugadora'
  end;

  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;

  insert into public.fitness_auth_sessions(player_user_id, player_id, username, role, token_hash, expires_at)
  values (
    v_user.player_user_id,
    v_user.player_id,
    v_user.username,
    v_role,
    encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'),
    v_expires_at
  );

  return jsonb_build_object(
    'session_token', v_token,
    'expires_at', v_expires_at,
    'user', jsonb_build_object(
      'player_id', v_user.player_id,
      'username', v_user.username,
      'role', v_role,
      'apodo', coalesce(v_user.apodo,''),
      'nombre', coalesce(v_user.nombre,''),
      'numero_camiseta', v_user.numero_camiseta,
      'foto', coalesce(v_user.foto,'')
    )
  );
end;
$$;

create or replace function public.fitness_revoke_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := public.fitness_session_token_from_headers();
begin
  if v_token is null then
    return;
  end if;

  update public.fitness_auth_sessions
  set revoked_at = now()
  where token_hash = encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
    and revoked_at is null;
end;
$$;

create or replace function public.fitness_month_ranking(p_fitness_month_id uuid)
returns table(
  "position" bigint,
  player_id uuid,
  player_alias text,
  player_name text,
  player_photo text,
  completed_required_videos integer,
  completed_routines integer,
  compliance_percent integer,
  points integer
)
language sql
stable
security definer
set search_path = public
as $$
with month_scope as (
  select id
  from public.fitness_months
  where id = p_fitness_month_id
    and ranking_enabled is true
    and (status = 'published' or public.fitness_can_manage())
), required_video as (
  select fv.id as fitness_video_id, fv.fitness_day_id
  from public.fitness_videos fv
  join public.fitness_days fd on fd.id = fv.fitness_day_id
  join month_scope ms on ms.id = fd.fitness_month_id
  where fd.day_type = 'workout'
    and fv.activity_type = 'required'
), totals as (
  select count(*)::integer as total_required
  from required_video
), required_day as (
  select fitness_day_id, count(*)::integer as required_count
  from required_video
  group by fitness_day_id
), eligible_players as (
  select p.id, p.apodo, p.nombre, p.foto
  from public.players p
  where coalesce(nullif(lower(p.estado::text), ''), 'activo') = 'activo'
), completed_by_day as (
  select fp.player_id, rv.fitness_day_id, count(distinct fp.fitness_video_id)::integer as completed
  from public.fitness_progress fp
  join required_video rv on rv.fitness_video_id = fp.fitness_video_id
  where fp.completed is true
  group by fp.player_id, rv.fitness_day_id
), score_base as (
  select
    ep.id as player_id,
    ep.apodo as player_alias,
    ep.nombre as player_name,
    ep.foto as player_photo,
    coalesce((
      select sum(cbd.completed)::integer
      from completed_by_day cbd
      where cbd.player_id = ep.id
    ), 0)::integer as completed_required_videos,
    coalesce((
      select count(*)::integer
      from required_day rd
      join completed_by_day cbd on cbd.fitness_day_id = rd.fitness_day_id
      where cbd.player_id = ep.id
        and cbd.completed >= rd.required_count
    ), 0)::integer as completed_routines,
    totals.total_required
  from eligible_players ep
  cross join totals
), scored as (
  select
    player_id,
    player_alias,
    player_name,
    player_photo,
    completed_required_videos,
    completed_routines,
    case when total_required > 0 then round((completed_required_videos::numeric / total_required::numeric) * 100)::integer else 0 end as compliance_percent,
    (completed_required_videos + completed_routines)::integer as points
  from score_base
)
select
  rank() over(order by points desc, completed_routines desc, compliance_percent desc, lower(coalesce(player_alias, player_name, ''))) as "position",
  player_id,
  player_alias,
  player_name,
  player_photo,
  completed_required_videos,
  completed_routines,
  compliance_percent,
  points
from scored
where points > 0
order by points desc, completed_routines desc, compliance_percent desc, lower(coalesce(player_alias, player_name, ''));
$$;

alter table public.fitness_auth_sessions enable row level security;
alter table public.fitness_months enable row level security;
alter table public.fitness_days enable row level security;
alter table public.fitness_videos enable row level security;
alter table public.fitness_progress enable row level security;

revoke all on public.fitness_auth_sessions from anon, authenticated;
grant select on public.fitness_months to anon, authenticated;
grant select on public.fitness_days to anon, authenticated;
grant select on public.fitness_videos to anon, authenticated;
grant select, insert, update, delete on public.fitness_progress to anon, authenticated;
grant insert, update, delete on public.fitness_months to anon, authenticated;
grant insert, update, delete on public.fitness_days to anon, authenticated;
grant insert, update, delete on public.fitness_videos to anon, authenticated;

drop policy if exists fitness_months_read on public.fitness_months;
create policy fitness_months_read on public.fitness_months
  for select using (status = 'published' or public.fitness_can_manage());

drop policy if exists fitness_months_insert_admin on public.fitness_months;
create policy fitness_months_insert_admin on public.fitness_months
  for insert with check (public.fitness_can_manage());

drop policy if exists fitness_months_update_admin on public.fitness_months;
create policy fitness_months_update_admin on public.fitness_months
  for update using (public.fitness_can_manage()) with check (public.fitness_can_manage());

drop policy if exists fitness_months_delete_admin on public.fitness_months;
create policy fitness_months_delete_admin on public.fitness_months
  for delete using (public.fitness_can_manage());

drop policy if exists fitness_days_read on public.fitness_days;
create policy fitness_days_read on public.fitness_days
  for select using (public.fitness_can_read_month(fitness_month_id));

drop policy if exists fitness_days_insert_admin on public.fitness_days;
create policy fitness_days_insert_admin on public.fitness_days
  for insert with check (public.fitness_can_manage());

drop policy if exists fitness_days_update_admin on public.fitness_days;
create policy fitness_days_update_admin on public.fitness_days
  for update using (public.fitness_can_manage()) with check (public.fitness_can_manage());

drop policy if exists fitness_days_delete_admin on public.fitness_days;
create policy fitness_days_delete_admin on public.fitness_days
  for delete using (public.fitness_can_manage());

drop policy if exists fitness_videos_read on public.fitness_videos;
create policy fitness_videos_read on public.fitness_videos
  for select using (
    exists (
      select 1
      from public.fitness_days fd
      where fd.id = fitness_day_id
        and public.fitness_can_read_month(fd.fitness_month_id)
    )
  );

drop policy if exists fitness_videos_insert_admin on public.fitness_videos;
create policy fitness_videos_insert_admin on public.fitness_videos
  for insert with check (public.fitness_can_manage());

drop policy if exists fitness_videos_update_admin on public.fitness_videos;
create policy fitness_videos_update_admin on public.fitness_videos
  for update using (public.fitness_can_manage()) with check (public.fitness_can_manage());

drop policy if exists fitness_videos_delete_admin on public.fitness_videos;
create policy fitness_videos_delete_admin on public.fitness_videos
  for delete using (public.fitness_can_manage());

drop policy if exists fitness_progress_read_own on public.fitness_progress;
create policy fitness_progress_read_own on public.fitness_progress
  for select using (player_id = public.fitness_current_player_id() or public.fitness_can_manage());

drop policy if exists fitness_progress_insert_own on public.fitness_progress;
create policy fitness_progress_insert_own on public.fitness_progress
  for insert with check (player_id = public.fitness_current_player_id() or public.fitness_can_manage());

drop policy if exists fitness_progress_update_own on public.fitness_progress;
create policy fitness_progress_update_own on public.fitness_progress
  for update using (player_id = public.fitness_current_player_id() or public.fitness_can_manage())
  with check (player_id = public.fitness_current_player_id() or public.fitness_can_manage());

drop policy if exists fitness_progress_delete_own on public.fitness_progress;
create policy fitness_progress_delete_own on public.fitness_progress
  for delete using (player_id = public.fitness_current_player_id() or public.fitness_can_manage());

grant execute on function public.fitness_session_token_from_headers() to anon, authenticated, service_role;
grant execute on function public.fitness_current_player_id() to anon, authenticated, service_role;
grant execute on function public.fitness_current_role() to anon, authenticated, service_role;
grant execute on function public.fitness_can_manage() to anon, authenticated, service_role;
grant execute on function public.fitness_can_read_month(uuid) to anon, authenticated, service_role;
grant execute on function public.fitness_create_session(text,text) to anon, authenticated, service_role;
grant execute on function public.fitness_revoke_session() to anon, authenticated, service_role;
grant execute on function public.fitness_month_ranking(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;