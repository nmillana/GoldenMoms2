-- 010_treasury_fix_pgcrypto_hash.sql
-- Fixes pgcrypto hashing for Supabase projects where digest(text, text) is unavailable.
-- Run after 009_treasury_custom_auth_bridge.sql if Treasury login shows a generic 009 error.

begin;

create extension if not exists pgcrypto;

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
    where s.token_hash = encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
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

  v_password_hash := encode(digest(convert_to(p_password, 'UTF8'), 'sha256'), 'hex');
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
  values (v_user.player_user_id, v_user.player_id, v_user.username, v_role, encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), v_expires_at);

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
  where token_hash = encode(digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex')
    and revoked_at is null;
end;
$$;

grant execute on function public.treasury_current_role() to anon, authenticated, service_role;
grant execute on function public.treasury_create_session(text,text) to anon, authenticated, service_role;
grant execute on function public.treasury_revoke_session() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
