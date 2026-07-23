-- 009_treasury_custom_auth_bridge.sql
-- Compatibility bridge for the current Golden Moms custom login.
-- This does not move the app to Supabase Auth. It creates short-lived Treasury sessions
-- and lets RPCs validate the session token from the x-gm-treasury-session header.

begin;

create extension if not exists pgcrypto;

create table if not exists public.treasury_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  player_user_id uuid not null references public.player_users(id),
  player_id uuid references public.players(id),
  username text not null,
  role text not null check (role in ('admin','capitana','tesorera')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists treasury_auth_sessions_token_hash_idx on public.treasury_auth_sessions(token_hash);
create index if not exists treasury_auth_sessions_valid_idx on public.treasury_auth_sessions(expires_at) where revoked_at is null;
alter table public.treasury_auth_sessions enable row level security;
revoke all on public.treasury_auth_sessions from anon, authenticated;

create or replace function public.treasury_session_token_from_headers()
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
    v_headers->>'x-gm-treasury-session',
    v_headers->>'X-GM-Treasury-Session'
  ), '');
end;
$$;

create or replace function public.treasury_current_role()
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

  if v_jwt_role in ('service_role','admin','capitana','tesorera') then
    return v_jwt_role;
  end if;

  v_token := public.treasury_session_token_from_headers();
  if v_token is not null then
    select s.role into v_session_role
    from public.treasury_auth_sessions s
    join public.player_users pu on pu.id = s.player_user_id
    where s.token_hash = encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
      and s.revoked_at is null
      and s.expires_at > now()
      and pu.active is true
    limit 1;

    if v_session_role in ('admin','capitana','tesorera') then
      return v_session_role;
    end if;
  end if;

  return coalesce(v_jwt_role, '');
end;
$$;

create or replace function public.treasury_assert_writer()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text := public.treasury_current_role();
begin
  if v_role in ('service_role','admin','capitana','tesorera') then
    return;
  end if;
  raise exception 'Rol no autorizado para operar Tesoreria' using errcode = '42501';
end;
$$;

create or replace function public.treasury_create_session(p_username text, p_password text)
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
  v_expires_at timestamptz := now() + interval '12 hours';
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
    when lower(coalesce(v_user.user_role,'')) in ('admin','capitana','tesorera') then lower(v_user.user_role)
    when lower(coalesce(v_user.player_role,'')) in ('admin','capitana','tesorera') then lower(v_user.player_role)
    else 'jugadora'
  end;

  if v_role not in ('admin','capitana','tesorera') then
    raise exception 'Esta cuenta no tiene acceso a Tesorera' using errcode = '42501';
  end if;

  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;

  insert into public.treasury_auth_sessions(player_user_id, player_id, username, role, token_hash, expires_at)
  values (v_user.player_user_id, v_user.player_id, v_user.username, v_role, encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), v_expires_at);

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

create or replace function public.treasury_revoke_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := public.treasury_session_token_from_headers();
begin
  if v_token is null then
    return;
  end if;
  update public.treasury_auth_sessions
  set revoked_at = now()
  where token_hash = encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
    and revoked_at is null;
end;
$$;

create or replace function public.treasury_log(
  p_operation_id text,
  p_idempotency_key text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.treasury_audit_log(
    operation_id, idempotency_key, action, entity_type, entity_id,
    actor_user_id, actor_role, payload, after_data
  ) values (
    coalesce(p_operation_id, gen_random_uuid()::text), p_idempotency_key, p_action, p_entity_type, p_entity_id,
    auth.uid(), public.treasury_current_role(), coalesce(p_payload,'{}'::jsonb), p_after
  ) on conflict do nothing;
end;
$$;

-- Base read privileges for the current static app. RLS in 005 limits reads to a valid Treasury session.
grant select on public.treasury_settings to anon, authenticated;
grant select on public.treasury_income to anon, authenticated;
grant select on public.monthly_fees to anon, authenticated;
grant select on public.player_credits to anon, authenticated;
grant select on public.credit_applications to anon, authenticated;
grant select on public.treasury_activities to anon, authenticated;
grant select on public.activity_debts to anon, authenticated;
grant select on public.payments to anon, authenticated;
grant select on public.payment_allocations to anon, authenticated;
grant select on public.treasury_movements to anon, authenticated;
grant select on public.dt_payments to anon, authenticated;
grant select on public.dt_payment_fees to anon, authenticated;
grant select on public.treasury_audit_log to anon, authenticated;
grant select on public.treasury_migration_runs to anon, authenticated;
grant select on public.personal_advances to anon, authenticated;
grant select on public.treasury_available_balance to anon, authenticated;
grant select on public.treasury_balance_by_class to anon, authenticated;

-- Direct writes remain blocked; financial mutations must go through RPC.
revoke insert, update, delete on public.treasury_settings from anon, authenticated;
revoke insert, update, delete on public.treasury_income from anon, authenticated;
revoke insert, update, delete on public.monthly_fees from anon, authenticated;
revoke insert, update, delete on public.player_credits from anon, authenticated;
revoke insert, update, delete on public.credit_applications from anon, authenticated;
revoke insert, update, delete on public.treasury_activities from anon, authenticated;
revoke insert, update, delete on public.activity_debts from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.payment_allocations from anon, authenticated;
revoke insert, update, delete on public.treasury_movements from anon, authenticated;
revoke insert, update, delete on public.dt_payments from anon, authenticated;
revoke insert, update, delete on public.dt_payment_fees from anon, authenticated;
revoke insert, update, delete on public.treasury_audit_log from anon, authenticated;
revoke insert, update, delete on public.treasury_migration_runs from anon, authenticated;
revoke all on public.treasury_auth_sessions from anon, authenticated;

-- RPC execute grants for the static app. Each write RPC calls treasury_assert_writer().
grant execute on function public.treasury_create_session(text,text) to anon, authenticated, service_role;
grant execute on function public.treasury_revoke_session() to anon, authenticated, service_role;
grant execute on function public.treasury_session_token_from_headers() to anon, authenticated, service_role;
grant execute on function public.treasury_current_role() to anon, authenticated, service_role;
grant execute on function public.treasury_assert_writer() to anon, authenticated, service_role;
grant execute on function public.treasury_upsert_settings(jsonb,text) to anon, authenticated, service_role;
grant execute on function public.treasury_generate_monthly_fees(integer,integer,text,uuid[],text) to anon, authenticated, service_role;
grant execute on function public.treasury_create_income(jsonb,text) to anon, authenticated, service_role;
grant execute on function public.treasury_confirm_income(uuid,timestamptz,text) to anon, authenticated, service_role;
grant execute on function public.treasury_cancel_income(uuid,text,text) to anon, authenticated, service_role;
grant execute on function public.treasury_create_monthly_fee_payment(uuid,integer,timestamptz,text) to anon, authenticated, service_role;
grant execute on function public.treasury_cancel_monthly_fee(uuid,text,text) to anon, authenticated, service_role;
grant execute on function public.treasury_register_dt_payment(integer,integer,text) to anon, authenticated, service_role;
grant execute on function public.treasury_create_activity_with_debts(jsonb,jsonb,text) to anon, authenticated, service_role;
grant execute on function public.treasury_add_activity_debt(uuid,uuid,integer,text) to anon, authenticated, service_role;
grant execute on function public.treasury_register_activity_debt_payment(uuid,timestamptz,text) to anon, authenticated, service_role;
grant execute on function public.treasury_mark_debt_no_charge(uuid,text,text) to anon, authenticated, service_role;
grant execute on function public.treasury_create_historical_adjustment(jsonb,text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
