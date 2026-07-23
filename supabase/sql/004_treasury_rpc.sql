-- 004_treasury_rpc.sql
-- Transactional RPC contract for the Golden Moms Treasury redesign.
-- Prepared only. Do not run before schema review, role review and RLS review.

begin;
create or replace function public.treasury_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    nullif(auth.jwt()->>'app_role',''),
    nullif(auth.jwt()->'app_metadata'->>'role',''),
    nullif(auth.jwt()->'user_metadata'->>'role',''),
    nullif(current_setting('request.jwt.claim.role', true),''),
    auth.role(),
    ''
  ));
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
    auth.uid(), nullif(current_setting('request.jwt.claim.role', true), ''), coalesce(p_payload,'{}'::jsonb), p_after
  ) on conflict do nothing;
end;
$$;

create or replace function public.treasury_active_setting(p_year integer)
returns public.treasury_settings
language sql
stable
set search_path = public
as $$
  select *
  from public.treasury_settings
  where year = p_year and is_active is true
  order by valid_from desc, created_at desc
  limit 1;
$$;

create or replace function public.treasury_insert_movement(
  p_movement_type text,
  p_direction text,
  p_amount integer,
  p_concept text,
  p_availability_class text,
  p_source_table text,
  p_source_id uuid,
  p_payment_id uuid default null,
  p_player_id uuid default null,
  p_beneficiary_player_id uuid default null,
  p_effective_date timestamptz default now(),
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    return null;
  end if;

  insert into public.treasury_movements(
    movement_type, direction, amount, concept, effective_date, availability_class,
    source_table, source_id, payment_id, player_id, beneficiary_player_id,
    idempotency_key, created_by_user_id
  ) values (
    p_movement_type, p_direction, p_amount, p_concept, coalesce(p_effective_date, now()), p_availability_class,
    p_source_table, p_source_id, p_payment_id, p_player_id, p_beneficiary_player_id,
    p_idempotency_key, auth.uid()
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null and p_idempotency_key is not null then
    select id into v_id from public.treasury_movements where idempotency_key = p_idempotency_key limit 1;
  end if;

  return v_id;
end;
$$;

create or replace function public.treasury_upsert_settings(p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_year integer := (p_payload->>'year')::integer;
  v_monthly integer := (p_payload->>'monthly_fee_amount')::integer;
  v_dt integer := (p_payload->>'dt_amount')::integer;
  v_fund integer := (p_payload->>'team_fund_amount')::integer;
  v_from date := coalesce(nullif(p_payload->>'valid_from','')::date, current_date);
begin
  perform public.treasury_assert_writer();
  select id into v_id from public.treasury_settings where idempotency_key = p_idempotency_key limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'idempotent', true);
  end if;

  if v_monthly <> v_dt + v_fund then
    raise exception 'La cuota debe ser igual a DT + Fondo';
  end if;

  update public.treasury_settings
    set is_active = false, valid_to = v_from - 1
  where year = v_year and is_active is true;

  insert into public.treasury_settings(
    year, monthly_fee_amount, dt_amount, team_fund_amount, valid_from, notes,
    idempotency_key, created_by_user_id
  ) values (
    v_year, v_monthly, v_dt, v_fund, v_from, nullif(p_payload->>'notes',''),
    p_idempotency_key, auth.uid()
  ) returning id into v_id;

  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'settings.created', 'treasury_settings', v_id, p_payload, null);
  return jsonb_build_object('id', v_id, 'idempotent', false);
end;
$$;

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

create or replace function public.treasury_create_income(p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.treasury_assert_writer();
  select id into v_id from public.treasury_income where idempotency_key = p_idempotency_key limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'idempotent', true);
  end if;

  insert into public.treasury_income(
    income_type, concept, amount, expected_date, source, notes, source_player_id,
    idempotency_key, created_by_user_id
  ) values (
    coalesce(nullif(p_payload->>'income_type',''),'other'),
    nullif(p_payload->>'concept',''),
    (p_payload->>'amount')::integer,
    nullif(p_payload->>'expected_date','')::date,
    nullif(p_payload->>'source',''),
    nullif(p_payload->>'notes',''),
    nullif(p_payload->>'source_player_id','')::uuid,
    p_idempotency_key,
    auth.uid()
  ) returning id into v_id;

  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'income.created', 'treasury_income', v_id, p_payload, null);
  return jsonb_build_object('id', v_id, 'idempotent', false);
end;
$$;

create or replace function public.treasury_confirm_income(p_income_id uuid, p_received_at timestamptz default now(), p_idempotency_key text default gen_random_uuid()::text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_income public.treasury_income%rowtype;
  v_payment_id uuid;
begin
  perform public.treasury_assert_writer();
  if exists(select 1 from public.treasury_audit_log where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('id', p_income_id, 'idempotent', true);
  end if;

  select * into v_income from public.treasury_income where id = p_income_id for update;
  if v_income.id is null then raise exception 'Ingreso no encontrado'; end if;
  if v_income.status <> 'pending' then raise exception 'Ingreso no esta pendiente'; end if;

  insert into public.payments(payer_player_id, payment_type, amount_received, paid_at, idempotency_key, created_by_user_id)
  values (v_income.source_player_id, 'income', v_income.amount, coalesce(p_received_at, now()), p_idempotency_key || '-payment', auth.uid())
  returning id into v_payment_id;

  update public.treasury_income
    set status = 'confirmed', received_at = coalesce(p_received_at, now())
  where id = p_income_id;

  perform public.treasury_insert_movement('income', 'in', v_income.amount, v_income.concept, 'team_fund', 'treasury_income', v_income.id, v_payment_id, v_income.source_player_id, null, coalesce(p_received_at, now()), p_idempotency_key || '-movement');
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'income.confirmed', 'treasury_income', v_income.id, to_jsonb(v_income), null);

  return jsonb_build_object('id', v_income.id, 'payment_id', v_payment_id);
end;
$$;

create or replace function public.treasury_cancel_income(p_income_id uuid, p_reason text, p_idempotency_key text default gen_random_uuid()::text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_income public.treasury_income%rowtype;
begin
  perform public.treasury_assert_writer();
  if exists(select 1 from public.treasury_audit_log where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('id', p_income_id, 'idempotent', true);
  end if;
  select * into v_income from public.treasury_income where id = p_income_id for update;
  if v_income.id is null then raise exception 'Ingreso no encontrado'; end if;
  if v_income.status <> 'pending' then raise exception 'Solo se cancelan ingresos pendientes'; end if;
  update public.treasury_income set status='cancelled', cancelled_at=now(), cancellation_reason=p_reason where id=p_income_id;
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'income.cancelled', 'treasury_income', p_income_id, jsonb_build_object('reason',p_reason), null);
  return jsonb_build_object('id', p_income_id);
end;
$$;

create or replace function public.treasury_create_monthly_fee_payment(
  p_monthly_fee_id uuid,
  p_amount_received integer,
  p_paid_at timestamptz default now(),
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee public.monthly_fees%rowtype;
  v_payment_id uuid;
  v_credit_available integer := 0;
  v_credit_to_apply integer := 0;
  v_credit_remaining integer := 0;
  v_use integer := 0;
  v_credit record;
  v_overpay integer := 0;
  v_credit_id uuid;
begin
  perform public.treasury_assert_writer();
  select id into v_payment_id from public.payments where idempotency_key = p_idempotency_key limit 1;
  if v_payment_id is not null then
    return jsonb_build_object('payment_id', v_payment_id, 'idempotent', true);
  end if;

  select * into v_fee from public.monthly_fees where id = p_monthly_fee_id for update;
  if v_fee.id is null then raise exception 'Cuota no encontrada'; end if;
  if v_fee.status <> 'pending' then raise exception 'Cuota no esta pendiente'; end if;

  select coalesce(sum(remaining_amount),0)::integer into v_credit_available
  from public.player_credits
  where player_id = v_fee.player_id and status = 'active' and remaining_amount > 0;

  v_credit_to_apply := least(v_credit_available, v_fee.gross_amount);
  if coalesce(p_amount_received,0) + v_credit_to_apply < v_fee.gross_amount then
    raise exception 'Monto insuficiente para cerrar la cuota';
  end if;

  insert into public.payments(payer_player_id, payment_type, amount_received, paid_at, idempotency_key, created_by_user_id)
  values (v_fee.player_id, 'monthly_fee', coalesce(p_amount_received,0), coalesce(p_paid_at, now()), p_idempotency_key, auth.uid())
  returning id into v_payment_id;

  v_credit_remaining := v_credit_to_apply;
  for v_credit in
    select * from public.player_credits
    where player_id = v_fee.player_id and status = 'active' and remaining_amount > 0
    order by created_at, id
    for update
  loop
    exit when v_credit_remaining <= 0;
    v_use := least(v_credit.remaining_amount, v_credit_remaining);
    update public.player_credits
      set remaining_amount = remaining_amount - v_use,
          status = case when remaining_amount - v_use = 0 then 'used' else status end
    where id = v_credit.id;
    insert into public.credit_applications(credit_id, player_id, target_type, target_id, amount, idempotency_key)
    values (v_credit.id, v_fee.player_id, 'monthly_fee', v_fee.id, v_use, p_idempotency_key || '-credit-' || v_credit.id::text)
    on conflict do nothing;
    perform public.treasury_insert_movement('credit_application', 'out', v_use, 'Aplicacion de credito a cuota', 'player_credit', 'credit_applications', v_credit.id, v_payment_id, v_fee.player_id, null, coalesce(p_paid_at, now()), p_idempotency_key || '-credit-movement-' || v_credit.id::text);
    v_credit_remaining := v_credit_remaining - v_use;
  end loop;

  update public.monthly_fees
    set status='paid', paid_at=coalesce(p_paid_at, now()), payment_id=v_payment_id,
        credit_applied_amount=v_credit_to_apply, amount_due=0
  where id = v_fee.id;

  perform public.treasury_insert_movement('monthly_fee_team_fund', 'in', v_fee.team_fund_amount, 'Cuota fondo equipo ' || lpad(v_fee.month::text,2,'0') || '/' || v_fee.year::text, 'team_fund', 'monthly_fees', v_fee.id, v_payment_id, v_fee.player_id, null, coalesce(p_paid_at, now()), p_idempotency_key || '-team-fund');
  perform public.treasury_insert_movement('monthly_fee_dt_reserved', 'in', v_fee.dt_amount, 'Reserva DT ' || lpad(v_fee.month::text,2,'0') || '/' || v_fee.year::text, 'dt_reserved', 'monthly_fees', v_fee.id, v_payment_id, v_fee.player_id, null, coalesce(p_paid_at, now()), p_idempotency_key || '-dt');

  v_overpay := greatest(coalesce(p_amount_received,0) + v_credit_to_apply - v_fee.gross_amount, 0);
  if v_overpay > 0 then
    insert into public.player_credits(player_id, origin_type, origin_table, origin_id, original_amount, remaining_amount, idempotency_key, created_by_user_id)
    values (v_fee.player_id, 'monthly_fee_overpayment', 'payments', v_payment_id, v_overpay, v_overpay, p_idempotency_key || '-overpay-credit', auth.uid())
    returning id into v_credit_id;
    perform public.treasury_insert_movement('player_credit_received', 'in', v_overpay, 'Credito a favor por sobrepago', 'player_credit', 'player_credits', v_credit_id, v_payment_id, v_fee.player_id, v_fee.player_id, coalesce(p_paid_at, now()), p_idempotency_key || '-overpay-movement');
  end if;

  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'monthly_fee.paid', 'monthly_fees', v_fee.id,
    jsonb_build_object('amount_received',p_amount_received,'credit_applied',v_credit_to_apply,'overpay',v_overpay), null);

  return jsonb_build_object('payment_id', v_payment_id, 'credit_applied', v_credit_to_apply, 'overpay_credit', v_overpay);
end;
$$;

create or replace function public.treasury_register_dt_payment(
  p_year integer,
  p_month integer,
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dt_id uuid;
  v_amount integer;
  v_count integer;
  v_unit integer;
begin
  perform public.treasury_assert_writer();
  select id into v_dt_id from public.dt_payments where idempotency_key = p_idempotency_key limit 1;
  if v_dt_id is not null then return jsonb_build_object('id', v_dt_id, 'idempotent', true); end if;

  select coalesce(sum(mf.dt_amount),0)::integer, count(*)::integer, coalesce(max(mf.dt_amount),0)::integer
    into v_amount, v_count, v_unit
  from public.monthly_fees mf
  where mf.year = p_year and mf.month = p_month and mf.status = 'paid'
    and not exists (select 1 from public.dt_payment_fees dpf where dpf.monthly_fee_id = mf.id);

  if v_amount <= 0 or v_count <= 0 then
    raise exception 'No hay cuotas pagadas pendientes de pago DT para este periodo';
  end if;

  insert into public.dt_payments(year, month, amount, unit_amount, fee_count, idempotency_key, created_by_user_id)
  values (p_year, p_month, v_amount, v_unit, v_count, p_idempotency_key, auth.uid())
  returning id into v_dt_id;

  insert into public.dt_payment_fees(dt_payment_id, monthly_fee_id, dt_amount)
  select v_dt_id, mf.id, mf.dt_amount
  from public.monthly_fees mf
  where mf.year = p_year and mf.month = p_month and mf.status = 'paid'
    and not exists (select 1 from public.dt_payment_fees dpf where dpf.monthly_fee_id = mf.id);

  perform public.treasury_insert_movement('dt_payment', 'out', v_amount, 'Pago DT ' || lpad(p_month::text,2,'0') || '/' || p_year::text, 'dt_reserved', 'dt_payments', v_dt_id, null, null, null, now(), p_idempotency_key || '-movement');
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'dt_payment.posted', 'dt_payments', v_dt_id, jsonb_build_object('year',p_year,'month',p_month,'amount',v_amount,'fee_count',v_count), null);

  return jsonb_build_object('id', v_dt_id, 'amount', v_amount, 'fee_count', v_count);
end;
$$;

create or replace function public.treasury_create_activity_with_debts(
  p_payload jsonb,
  p_debts jsonb default '[]'::jsonb,
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_total integer := (p_payload->>'total_cost')::integer;
  v_team integer := coalesce(nullif(p_payload->>'team_contribution','')::integer, 0);
  v_payer uuid := nullif(p_payload->>'payer_player_id','')::uuid;
  v_distribution text := coalesce(nullif(p_payload->>'distribution_type',''),'equal');
  v_work_debts jsonb := coalesce(p_debts, '[]'::jsonb);
  v_count integer := 0;
  v_target_total integer;
  v_sum integer := 0;
  v_base integer;
  v_remainder integer;
  v_idx integer := 0;
  v_item jsonb;
  v_amount integer;
  v_player uuid;
  v_beneficiary uuid;
begin
  perform public.treasury_assert_writer();
  select id into v_activity_id from public.treasury_activities where idempotency_key = p_idempotency_key limit 1;
  if v_activity_id is not null then return jsonb_build_object('id', v_activity_id, 'idempotent', true); end if;

  if v_total < 0 or v_team < 0 or v_team > v_total then raise exception 'Montos invalidos'; end if;
  if v_payer is not null and v_distribution = 'equal' and not exists (
    select 1 from jsonb_array_elements(v_work_debts) x where (x->>'player_id')::uuid = v_payer
  ) then
    v_work_debts := v_work_debts || jsonb_build_array(jsonb_build_object('player_id', v_payer, 'assigned_amount', 0));
  end if;

  if v_payer is not null and v_distribution = 'individual' and not exists (
    select 1 from jsonb_array_elements(v_work_debts) x where (x->>'player_id')::uuid = v_payer
  ) then
    raise exception 'Incluye a la persona que pago y asigna su propio monto para descontarlo';
  end if;

  v_count := coalesce(jsonb_array_length(v_work_debts),0);
  if v_payer is not null and v_count = 0 then raise exception 'Un adelanto personal debe tener participantes a cobrar'; end if;

  v_target_total := greatest(v_total - v_team, 0);

  if v_distribution = 'individual' then
    select coalesce(sum((x->>'assigned_amount')::integer),0)::integer into v_sum from jsonb_array_elements(v_work_debts) x;
    if v_count > 0 and v_sum <> v_target_total then
      raise exception 'La suma individual debe cuadrar con el costo menos aporte equipo';
    end if;
  end if;

  insert into public.treasury_activities(
    name, activity_type, activity_date, total_cost, team_contribution, payer_player_id,
    distribution_type, notes, idempotency_key, created_by_user_id
  ) values (
    nullif(p_payload->>'name',''),
    coalesce(nullif(p_payload->>'activity_type',''),'otro'),
    nullif(p_payload->>'activity_date','')::date,
    v_total, v_team, v_payer, v_distribution,
    nullif(p_payload->>'notes',''), p_idempotency_key, auth.uid()
  ) returning id into v_activity_id;

  if v_count > 0 then
    v_base := case when v_distribution = 'equal' then floor(v_target_total::numeric / v_count)::integer else null end;
    v_remainder := case when v_distribution = 'equal' then v_target_total - (v_base * v_count) else 0 end;

    for v_item in select * from jsonb_array_elements(v_work_debts) loop
      v_idx := v_idx + 1;
      v_player := (v_item->>'player_id')::uuid;
      if v_distribution = 'equal' then
        v_amount := v_base + case when v_idx <= v_remainder then 1 else 0 end;
      else
        v_amount := coalesce((v_item->>'assigned_amount')::integer,0);
      end if;
      v_beneficiary := case when v_payer is not null and v_player <> v_payer then v_payer else null end;
      insert into public.activity_debts(activity_id, player_id, beneficiary_player_id, assigned_amount, status, no_charge_reason, idempotency_key)
      values (
        v_activity_id, v_player, v_beneficiary, v_amount,
        case when v_payer is not null and v_player = v_payer then 'no_charge' else 'pending' end,
        case when v_payer is not null and v_player = v_payer then 'Descuento por pago personal' else null end,
        p_idempotency_key || '-debt-' || v_player::text
      ) on conflict do nothing;
    end loop;
  end if;

  if v_payer is null and v_total > 0 then
    perform public.treasury_insert_movement('activity_expense', 'out', v_total, coalesce(nullif(p_payload->>'name',''),'Gasto equipo'), 'team_fund', 'treasury_activities', v_activity_id, null, null, null, now(), p_idempotency_key || '-team-expense');
  elsif v_payer is not null and v_team > 0 then
    perform public.treasury_insert_movement('team_contribution', 'out', v_team, 'Aporte equipo: ' || coalesce(nullif(p_payload->>'name',''),'Actividad'), 'team_fund', 'treasury_activities', v_activity_id, null, null, null, now(), p_idempotency_key || '-team-contribution');
  end if;

  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'activity.created', 'treasury_activities', v_activity_id, jsonb_build_object('payload',p_payload,'debts',v_work_debts), null);
  return jsonb_build_object('id', v_activity_id, 'debt_count', v_count);
end;
$$;

create or replace function public.treasury_register_activity_debt_payment(
  p_activity_debt_id uuid,
  p_paid_at timestamptz default now(),
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.activity_debts%rowtype;
  v_activity public.treasury_activities%rowtype;
  v_payment_id uuid;
  v_class text;
begin
  perform public.treasury_assert_writer();
  select id into v_payment_id from public.payments where idempotency_key = p_idempotency_key limit 1;
  if v_payment_id is not null then return jsonb_build_object('payment_id', v_payment_id, 'idempotent', true); end if;

  select * into v_debt from public.activity_debts where id = p_activity_debt_id for update;
  if v_debt.id is null then raise exception 'Deuda no encontrada'; end if;
  if v_debt.status <> 'pending' then raise exception 'Deuda no esta pendiente'; end if;
  select * into v_activity from public.treasury_activities where id = v_debt.activity_id;

  insert into public.payments(payer_player_id, payment_type, amount_received, paid_at, idempotency_key, created_by_user_id)
  values (v_debt.player_id, 'activity_debt', v_debt.assigned_amount, coalesce(p_paid_at, now()), p_idempotency_key, auth.uid())
  returning id into v_payment_id;

  update public.activity_debts
    set status='paid', paid_amount=assigned_amount, paid_at=coalesce(p_paid_at, now()), payment_id=v_payment_id
  where id = v_debt.id;

  v_class := case when v_debt.beneficiary_player_id is null then 'team_fund' else 'personal_reimbursement' end;
  perform public.treasury_insert_movement('activity_debt_payment', 'in', v_debt.assigned_amount, v_activity.name, v_class, 'activity_debts', v_debt.id, v_payment_id, v_debt.player_id, v_debt.beneficiary_player_id, coalesce(p_paid_at, now()), p_idempotency_key || '-movement');
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'activity_debt.paid', 'activity_debts', v_debt.id, to_jsonb(v_debt), null);

  return jsonb_build_object('payment_id', v_payment_id, 'availability_class', v_class);
end;
$$;

create or replace function public.treasury_mark_debt_no_charge(
  p_activity_debt_id uuid,
  p_reason text,
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt public.activity_debts%rowtype;
begin
  perform public.treasury_assert_writer();
  if exists(select 1 from public.treasury_audit_log where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('id', p_activity_debt_id, 'idempotent', true);
  end if;
  select * into v_debt from public.activity_debts where id = p_activity_debt_id for update;
  if v_debt.id is null then raise exception 'Deuda no encontrada'; end if;
  if v_debt.status <> 'pending' then raise exception 'Solo se marca No cobrar desde pendiente'; end if;
  update public.activity_debts set status='no_charge', no_charge_reason=p_reason where id=p_activity_debt_id;
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'activity_debt.no_charge', 'activity_debts', p_activity_debt_id, jsonb_build_object('reason',p_reason), null);
  return jsonb_build_object('id', p_activity_debt_id);
end;
$$;

create or replace function public.treasury_create_historical_adjustment(p_payload jsonb, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_movement_id uuid;
  v_type text := coalesce(nullif(p_payload->>'adjustment_type',''),'other');
  v_amount integer := (p_payload->>'amount')::integer;
  v_direction text;
begin
  perform public.treasury_assert_writer();
  select id into v_movement_id from public.treasury_movements where idempotency_key = p_idempotency_key limit 1;
  if v_movement_id is not null then return jsonb_build_object('movement_id', v_movement_id, 'idempotent', true); end if;
  if v_amount <= 0 then raise exception 'Monto invalido'; end if;
  v_direction := case when v_type = 'negative_correction' then 'out' else 'in' end;
  v_movement_id := public.treasury_insert_movement('historical_adjustment', v_direction, v_amount, coalesce(nullif(p_payload->>'reason',''),'Ajuste historico'), 'team_fund', 'treasury_movements', null, null, null, null, now(), p_idempotency_key);
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'historical_adjustment.created', 'treasury_movements', v_movement_id, p_payload, null);
  return jsonb_build_object('movement_id', v_movement_id);
end;
$$;


create or replace function public.treasury_cancel_monthly_fee(
  p_monthly_fee_id uuid,
  p_reason text,
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee public.monthly_fees%rowtype;
begin
  perform public.treasury_assert_writer();
  if exists(select 1 from public.treasury_audit_log where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('id', p_monthly_fee_id, 'idempotent', true);
  end if;
  select * into v_fee from public.monthly_fees where id = p_monthly_fee_id for update;
  if v_fee.id is null then raise exception 'Cuota no encontrada'; end if;
  if v_fee.status <> 'pending' then raise exception 'Solo se puede cancelar una cuota pendiente'; end if;
  update public.monthly_fees
    set status='cancelled', amount_due=0, cancelled_at=now(), cancellation_reason=p_reason
  where id=p_monthly_fee_id;
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'monthly_fee.cancelled', 'monthly_fees', p_monthly_fee_id, jsonb_build_object('reason',p_reason), null);
  return jsonb_build_object('id', p_monthly_fee_id);
end;
$$;

create or replace function public.treasury_add_activity_debt(
  p_activity_id uuid,
  p_player_id uuid,
  p_assigned_amount integer,
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.treasury_activities%rowtype;
  v_debt_id uuid;
  v_beneficiary uuid;
begin
  perform public.treasury_assert_writer();
  select id into v_debt_id from public.activity_debts where idempotency_key=p_idempotency_key limit 1;
  if v_debt_id is not null then return jsonb_build_object('id', v_debt_id, 'idempotent', true); end if;
  if p_assigned_amount is null or p_assigned_amount <= 0 then raise exception 'Monto invalido'; end if;
  select * into v_activity from public.treasury_activities where id=p_activity_id for update;
  if v_activity.id is null then raise exception 'Actividad no encontrada'; end if;
  if v_activity.administrative_status not in ('draft','open') then raise exception 'La actividad no admite nuevos cobros'; end if;
  v_beneficiary := case when v_activity.payer_player_id is not null and p_player_id <> v_activity.payer_player_id then v_activity.payer_player_id else null end;
  insert into public.activity_debts(activity_id, player_id, beneficiary_player_id, assigned_amount, status, no_charge_reason, idempotency_key)
  values (
    p_activity_id, p_player_id, v_beneficiary, p_assigned_amount,
    case when v_activity.payer_player_id is not null and p_player_id = v_activity.payer_player_id then 'no_charge' else 'pending' end,
    case when v_activity.payer_player_id is not null and p_player_id = v_activity.payer_player_id then 'Descuento por pago personal' else null end,
    p_idempotency_key
  )
  returning id into v_debt_id;
  perform public.treasury_log(gen_random_uuid()::text, p_idempotency_key, 'activity_debt.added', 'activity_debts', v_debt_id, jsonb_build_object('activity_id',p_activity_id,'player_id',p_player_id,'amount',p_assigned_amount), null);
  return jsonb_build_object('id', v_debt_id);
end;
$$;
grant execute on function public.treasury_upsert_settings(jsonb,text) to authenticated, service_role;
grant execute on function public.treasury_generate_monthly_fees(integer,integer,text,uuid[],text) to authenticated, service_role;
grant execute on function public.treasury_create_income(jsonb,text) to authenticated, service_role;
grant execute on function public.treasury_confirm_income(uuid,timestamptz,text) to authenticated, service_role;
grant execute on function public.treasury_cancel_income(uuid,text,text) to authenticated, service_role;
grant execute on function public.treasury_create_monthly_fee_payment(uuid,integer,timestamptz,text) to authenticated, service_role;
grant execute on function public.treasury_cancel_monthly_fee(uuid,text,text) to authenticated, service_role;
grant execute on function public.treasury_register_dt_payment(integer,integer,text) to authenticated, service_role;
grant execute on function public.treasury_create_activity_with_debts(jsonb,jsonb,text) to authenticated, service_role;
grant execute on function public.treasury_add_activity_debt(uuid,uuid,integer,text) to authenticated, service_role;
grant execute on function public.treasury_register_activity_debt_payment(uuid,timestamptz,text) to authenticated, service_role;
grant execute on function public.treasury_mark_debt_no_charge(uuid,text,text) to authenticated, service_role;
grant execute on function public.treasury_create_historical_adjustment(jsonb,text) to authenticated, service_role;
grant execute on function public.treasury_current_role() to authenticated, service_role;
grant execute on function public.treasury_assert_writer() to authenticated, service_role;

commit;
