begin;

-- Fix: players.estado is an enum in production. Cast it to text before coalesce so cuota generation does not try to cast an empty string into the enum.
create or replace function public.treasury_generate_monthly_fees(
  p_year integer,
  p_month integer,
  p_team text default 'Golden Moms',
  p_extra_player_ids uuid[] default '{}'::uuid[],
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting public.treasury_settings%rowtype;
  v_count integer := 0;
begin
  perform public.treasury_assert_writer();
  if exists(select 1 from public.treasury_audit_log where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('idempotent', true);
  end if;

  select * into v_setting from public.treasury_active_setting(p_year);
  if v_setting.id is null then
    raise exception 'No existe configuracion activa para el ano %', p_year;
  end if;

  with target_players as (
    select p.id
    from public.players p
    where (
      lower(coalesce(p.estado::text,'')) = 'activo'
      and (p_team = 'Todos' or coalesce(p.equipos::text,'') ilike '%' || p_team || '%')
    )
    or p.id = any(coalesce(p_extra_player_ids, '{}'::uuid[]))
  ), inserted as (
    insert into public.monthly_fees(
      player_id, year, month, team, gross_amount, dt_amount, team_fund_amount,
      amount_due, due_date, generated_from_settings_id, generated_by_user_id,
      idempotency_key
    )
    select distinct id, p_year, p_month, p_team, v_setting.monthly_fee_amount, v_setting.dt_amount,
      v_setting.team_fund_amount, v_setting.monthly_fee_amount,
      make_date(p_year, p_month, 10), v_setting.id, auth.uid(),
      p_idempotency_key || '-' || id::text
    from target_players
    on conflict do nothing
    returning id
  ) select count(*) into v_count from inserted;

  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'monthly_fees.generated', 'monthly_fees', null,
    jsonb_build_object('year',p_year,'month',p_month,'team',p_team,'extra_player_ids',p_extra_player_ids,'inserted',v_count), null);

  return jsonb_build_object('inserted', v_count, 'idempotent', false);
end;
$$;

grant execute on function public.treasury_generate_monthly_fees(integer,integer,text,uuid[],text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';

commit;
