begin;

-- Agrega varias jugadoras a una cuota mensual existente o adelantada.
-- No crea movimientos financieros: solo deja cuotas pendientes para cobrar.
create or replace function public.treasury_add_monthly_fee_players(
  p_year integer,
  p_month integer,
  p_team text default 'Golden Moms',
  p_player_ids uuid[] default '{}'::uuid[],
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting public.treasury_settings%rowtype;
  v_inserted integer := 0;
  v_requested integer := 0;
  v_operation_key text := coalesce(nullif(p_idempotency_key, ''), gen_random_uuid()::text);
begin
  perform public.treasury_assert_writer();

  if exists(select 1 from public.treasury_audit_log where idempotency_key = v_operation_key) then
    return jsonb_build_object('idempotent', true, 'inserted', 0);
  end if;

  if p_year is null then
    raise exception 'Ano invalido';
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Mes invalido';
  end if;

  v_requested := coalesce(array_length(p_player_ids, 1), 0);
  if v_requested = 0 then
    raise exception 'Selecciona al menos una jugadora';
  end if;

  select * into v_setting
  from public.treasury_active_setting(p_year);

  if v_setting.id is null then
    raise exception 'No existe configuracion activa para el ano %', p_year;
  end if;

  with selected_players as (
    select distinct unnest(p_player_ids) as player_id
  ), eligible_players as (
    select sp.player_id
    from selected_players sp
    join public.players p on p.id = sp.player_id
    where not exists (
      select 1
      from public.monthly_fees mf
      where mf.player_id = sp.player_id
        and mf.year = p_year
        and mf.month = p_month
        and mf.status in ('pending', 'paid')
    )
  ), inserted as (
    insert into public.monthly_fees(
      player_id,
      year,
      month,
      team,
      gross_amount,
      dt_amount,
      team_fund_amount,
      amount_due,
      due_date,
      generated_from_settings_id,
      generated_by_user_id,
      idempotency_key
    )
    select
      ep.player_id,
      p_year,
      p_month,
      coalesce(nullif(p_team, ''), 'Golden Moms'),
      v_setting.monthly_fee_amount,
      v_setting.dt_amount,
      v_setting.team_fund_amount,
      v_setting.monthly_fee_amount,
      make_date(p_year, p_month, 10),
      v_setting.id,
      auth.uid(),
      v_operation_key || '-' || ep.player_id::text
    from eligible_players ep
    on conflict do nothing
    returning id
  )
  select count(*) into v_inserted from inserted;

  perform public.treasury_log(
    gen_random_uuid()::text,
    v_operation_key,
    'monthly_fee.players_added',
    'monthly_fees',
    null,
    jsonb_build_object(
      'year', p_year,
      'month', p_month,
      'team', coalesce(nullif(p_team, ''), 'Golden Moms'),
      'requested', v_requested,
      'inserted', v_inserted,
      'player_ids', p_player_ids
    ),
    null
  );

  return jsonb_build_object(
    'idempotent', false,
    'requested', v_requested,
    'inserted', v_inserted
  );
end;
$$;

grant execute on function public.treasury_add_monthly_fee_players(integer, integer, text, uuid[], text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;

select
  'treasury_add_monthly_fee_players_ready' as check_name,
  proname as function_name
from pg_proc
where proname = 'treasury_add_monthly_fee_players';
