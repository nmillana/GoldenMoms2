-- 021_treasury_reallocate_liga_invierno_to_wondra.sql
-- Golden Moms - Reasigna los abonos de Liga invierno colegio Mayor cancelada a Wondra 1 y Wondra 2.
-- Ejecutar una vez en Supabase SQL editor. Es idempotente y valida los totales antes de modificar.

begin;

create extension if not exists pgcrypto;

-- Ajuste permanente: al cerrar una deuda parcialmente abonada, cobrar solo el saldo pendiente.
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
  v_due integer := 0;
begin
  perform public.treasury_assert_writer();

  select id into v_payment_id
  from public.payments
  where idempotency_key = p_idempotency_key
  limit 1;

  if v_payment_id is not null then
    return jsonb_build_object('payment_id', v_payment_id, 'idempotent', true);
  end if;

  select * into v_debt
  from public.activity_debts
  where id = p_activity_debt_id
  for update;

  if v_debt.id is null then
    raise exception 'Deuda no encontrada';
  end if;

  if v_debt.status <> 'pending' then
    raise exception 'Deuda no esta pendiente';
  end if;

  v_due := greatest(coalesce(v_debt.assigned_amount, 0) - coalesce(v_debt.paid_amount, 0), 0);

  if v_due <= 0 then
    raise exception 'Deuda sin saldo pendiente';
  end if;

  select * into v_activity
  from public.treasury_activities
  where id = v_debt.activity_id;

  insert into public.payments(
    payer_player_id,
    payment_type,
    amount_received,
    paid_at,
    idempotency_key,
    created_by_user_id
  ) values (
    v_debt.player_id,
    'activity_debt',
    v_due,
    coalesce(p_paid_at, now()),
    p_idempotency_key,
    auth.uid()
  ) returning id into v_payment_id;

  update public.activity_debts
     set status = 'paid',
         paid_amount = assigned_amount,
         paid_at = coalesce(p_paid_at, now()),
         payment_id = v_payment_id,
         updated_at = now()
   where id = v_debt.id;

  v_class := case when v_debt.beneficiary_player_id is null then 'team_fund' else 'personal_reimbursement' end;

  insert into public.payment_allocations(
    payment_id,
    target_type,
    target_id,
    player_id,
    beneficiary_player_id,
    amount,
    availability_class,
    status,
    idempotency_key
  ) values (
    v_payment_id,
    'activity_debt',
    v_debt.id,
    v_debt.player_id,
    v_debt.beneficiary_player_id,
    v_due,
    v_class,
    'posted',
    p_idempotency_key || '-allocation'
  ) on conflict do nothing;

  perform public.treasury_insert_movement(
    'activity_debt_payment',
    'in',
    v_due,
    v_activity.name,
    v_class,
    'activity_debts',
    v_debt.id,
    v_payment_id,
    v_debt.player_id,
    v_debt.beneficiary_player_id,
    coalesce(p_paid_at, now()),
    p_idempotency_key || '-movement'
  );

  perform public.treasury_log(
    gen_random_uuid()::text,
    p_idempotency_key,
    'activity_debt.paid',
    'activity_debts',
    v_debt.id,
    jsonb_build_object(
      'amount_received', v_due,
      'assigned_amount', v_debt.assigned_amount,
      'paid_before', v_debt.paid_amount,
      'availability_class', v_class
    ),
    null
  );

  return jsonb_build_object('payment_id', v_payment_id, 'availability_class', v_class, 'amount_received', v_due);
end;
$$;

grant execute on function public.treasury_register_activity_debt_payment(uuid, timestamptz, text) to anon, authenticated, service_role;

do $$
declare
  v_operation_key text := 'tesorera-reallocate-liga-colegio-mayor-wondra-20260729';
  v_liga_id uuid;
  v_wondra1_id uuid;
  v_wondra2_id uuid;
  v_players integer := 0;
  v_credit_total integer := 0;
  v_wondra1_total integer := 0;
  v_wondra2_total integer := 0;
  v_leftover_total integer := 0;
begin
  if exists (
    select 1
    from public.treasury_audit_log
    where idempotency_key = v_operation_key
      and action = 'activity_credit.reallocated'
  ) then
    raise notice 'Reasignacion Liga invierno -> Wondra ya aplicada. Se omite.';
    return;
  end if;

  select id into v_liga_id
  from public.treasury_activities
  where lower(trim(name)) = lower('Liga invierno colegio Mayor')
  order by created_at desc
  limit 1;

  select id into v_wondra1_id
  from public.treasury_activities
  where lower(trim(name)) = lower('Wondra 1 semestre')
  order by created_at desc
  limit 1;

  select id into v_wondra2_id
  from public.treasury_activities
  where lower(trim(name)) = lower('Wondra 2 semestre')
  order by created_at desc
  limit 1;

  if v_liga_id is null or v_wondra1_id is null or v_wondra2_id is null then
    raise exception 'No se encontraron las actividades Liga/Wondra necesarias';
  end if;

  drop table if exists pg_temp.tmp_liga_wondra_reallocation;

  create temporary table tmp_liga_wondra_reallocation on commit drop as
  with base as (
    select
      liga.id as liga_debt_id,
      liga.player_id,
      liga.payment_id as liga_payment_id,
      coalesce(liga.paid_at, now()) as original_paid_at,
      greatest(coalesce(liga.paid_amount, 0), case when liga.status = 'paid' then coalesce(liga.assigned_amount, 0) else 0 end)::integer as credit_amount,
      w1.id as wondra1_debt_id,
      coalesce(w1.assigned_amount, 0)::integer as wondra1_assigned,
      coalesce(w1.paid_amount, 0)::integer as wondra1_paid,
      w2.id as wondra2_debt_id,
      coalesce(w2.assigned_amount, 0)::integer as wondra2_assigned,
      coalesce(w2.paid_amount, 0)::integer as wondra2_paid
    from public.activity_debts liga
    join public.activity_debts w1
      on w1.activity_id = v_wondra1_id
     and w1.player_id = liga.player_id
     and w1.status = 'pending'
    join public.activity_debts w2
      on w2.activity_id = v_wondra2_id
     and w2.player_id = liga.player_id
     and w2.status = 'pending'
    where liga.activity_id = v_liga_id
      and liga.status = 'paid'
  ), calc as (
    select
      base.*,
      greatest(wondra1_assigned - wondra1_paid, 0)::integer as wondra1_due,
      greatest(wondra2_assigned - wondra2_paid, 0)::integer as wondra2_due
    from base
  ), applied as (
    select
      calc.*,
      least(credit_amount, wondra1_due)::integer as wondra1_apply
    from calc
  )
  select
    applied.*,
    least(greatest(credit_amount - wondra1_apply, 0), wondra2_due)::integer as wondra2_apply,
    greatest(credit_amount - wondra1_apply - least(greatest(credit_amount - wondra1_apply, 0), wondra2_due), 0)::integer as leftover_credit
  from applied;

  select
    count(*)::integer,
    coalesce(sum(credit_amount), 0)::integer,
    coalesce(sum(wondra1_apply), 0)::integer,
    coalesce(sum(wondra2_apply), 0)::integer,
    coalesce(sum(leftover_credit), 0)::integer
  into v_players, v_credit_total, v_wondra1_total, v_wondra2_total, v_leftover_total
  from tmp_liga_wondra_reallocation;

  if v_players <> 7 then
    raise exception 'Se esperaban 7 jugadoras pagadas en Liga invierno; encontradas %', v_players;
  end if;

  if v_credit_total <> 330001 then
    raise exception 'Se esperaban $330.001 abonados en Liga invierno; encontrado %', v_credit_total;
  end if;

  if v_leftover_total <> 0 then
    raise exception 'Queda credito sin aplicar: %', v_leftover_total;
  end if;

  if exists (select 1 from tmp_liga_wondra_reallocation where liga_payment_id is null) then
    raise exception 'Hay abonos de Liga invierno sin payment_id; revisar antes de reasignar';
  end if;

  update public.payment_allocations pa
     set status = 'reversed',
         reversed_at = now(),
         reversal_reason = 'Liga invierno colegio Mayor cancelada: abono reasignado a Wondra 1 y Wondra 2'
  from tmp_liga_wondra_reallocation r
  where pa.target_type = 'activity_debt'
    and pa.target_id = r.liga_debt_id
    and pa.status = 'posted';

  update public.treasury_movements m
     set status = 'reversed',
         reversed_at = now(),
         reversal_reason = 'Liga invierno colegio Mayor cancelada: abono reasignado a Wondra 1 y Wondra 2'
  from tmp_liga_wondra_reallocation r
  where m.source_table = 'activity_debts'
    and m.source_id = r.liga_debt_id
    and m.direction = 'in'
    and m.status = 'posted';

  update public.payments p
     set notes = concat_ws(' | ', nullif(p.notes, ''), 'Pago original de Liga invierno colegio Mayor reasignado a Wondra 1 y Wondra 2')
  from tmp_liga_wondra_reallocation r
  where p.id = r.liga_payment_id
    and coalesce(p.notes, '') not ilike '%reasignado a Wondra 1 y Wondra 2%';

  insert into public.payment_allocations(
    payment_id,
    target_type,
    target_id,
    player_id,
    amount,
    availability_class,
    status,
    idempotency_key
  )
  select
    liga_payment_id,
    'activity_debt',
    wondra1_debt_id,
    player_id,
    wondra1_apply,
    'team_fund',
    'posted',
    v_operation_key || '-alloc-w1-' || player_id::text
  from tmp_liga_wondra_reallocation
  where wondra1_apply > 0
  on conflict do nothing;

  insert into public.payment_allocations(
    payment_id,
    target_type,
    target_id,
    player_id,
    amount,
    availability_class,
    status,
    idempotency_key
  )
  select
    liga_payment_id,
    'activity_debt',
    wondra2_debt_id,
    player_id,
    wondra2_apply,
    'team_fund',
    'posted',
    v_operation_key || '-alloc-w2-' || player_id::text
  from tmp_liga_wondra_reallocation
  where wondra2_apply > 0
  on conflict do nothing;

  insert into public.treasury_movements(
    movement_type,
    direction,
    amount,
    concept,
    effective_date,
    availability_class,
    source_table,
    source_id,
    payment_id,
    player_id,
    status,
    idempotency_key
  )
  select
    'activity_debt_payment',
    'in',
    wondra1_apply,
    'Wondra 1 semestre',
    original_paid_at,
    'team_fund',
    'activity_debts',
    wondra1_debt_id,
    liga_payment_id,
    player_id,
    'posted',
    v_operation_key || '-movement-w1-' || player_id::text
  from tmp_liga_wondra_reallocation
  where wondra1_apply > 0
  on conflict do nothing;

  insert into public.treasury_movements(
    movement_type,
    direction,
    amount,
    concept,
    effective_date,
    availability_class,
    source_table,
    source_id,
    payment_id,
    player_id,
    status,
    idempotency_key
  )
  select
    'activity_debt_payment',
    'in',
    wondra2_apply,
    'Wondra 2 semestre',
    original_paid_at,
    'team_fund',
    'activity_debts',
    wondra2_debt_id,
    liga_payment_id,
    player_id,
    'posted',
    v_operation_key || '-movement-w2-' || player_id::text
  from tmp_liga_wondra_reallocation
  where wondra2_apply > 0
  on conflict do nothing;

  update public.activity_debts d
     set paid_amount = least(d.assigned_amount, coalesce(d.paid_amount, 0) + r.wondra1_apply),
         status = case when least(d.assigned_amount, coalesce(d.paid_amount, 0) + r.wondra1_apply) >= d.assigned_amount then 'paid' else 'pending' end,
         paid_at = case when least(d.assigned_amount, coalesce(d.paid_amount, 0) + r.wondra1_apply) >= d.assigned_amount then coalesce(d.paid_at, r.original_paid_at, now()) else d.paid_at end,
         payment_id = coalesce(d.payment_id, r.liga_payment_id),
         updated_at = now()
  from tmp_liga_wondra_reallocation r
  where d.id = r.wondra1_debt_id
    and r.wondra1_apply > 0;

  update public.activity_debts d
     set paid_amount = least(d.assigned_amount, coalesce(d.paid_amount, 0) + r.wondra2_apply),
         status = case when least(d.assigned_amount, coalesce(d.paid_amount, 0) + r.wondra2_apply) >= d.assigned_amount then 'paid' else 'pending' end,
         paid_at = case when least(d.assigned_amount, coalesce(d.paid_amount, 0) + r.wondra2_apply) >= d.assigned_amount then coalesce(d.paid_at, r.original_paid_at, now()) else d.paid_at end,
         payment_id = coalesce(d.payment_id, r.liga_payment_id),
         updated_at = now()
  from tmp_liga_wondra_reallocation r
  where d.id = r.wondra2_debt_id
    and r.wondra2_apply > 0;

  update public.activity_debts d
     set status = 'cancelled',
         paid_amount = 0,
         paid_at = null,
         payment_id = null,
         no_charge_reason = case
           when exists (select 1 from tmp_liga_wondra_reallocation r where r.liga_debt_id = d.id)
             then 'Liga cancelada: abono aplicado a Wondra 1 y Wondra 2'
           else 'Liga cancelada'
         end,
         updated_at = now()
  where d.activity_id = v_liga_id
    and d.status in ('paid', 'pending', 'no_charge');

  update public.treasury_activities
     set administrative_status = 'cancelled',
         cancelled_at = coalesce(cancelled_at, now()),
         cancellation_reason = 'Liga invierno colegio Mayor cancelada; abonos aplicados a Wondra 1 y Wondra 2',
         notes = concat_ws(E'\n', nullif(notes, ''), 'Cancelada: abonos aplicados a Wondra 1 y Wondra 2.'),
         updated_at = now()
  where id = v_liga_id;

  perform public.treasury_log(
    gen_random_uuid()::text,
    v_operation_key,
    'activity_credit.reallocated',
    'treasury_activities',
    v_liga_id,
    jsonb_build_object(
      'liga_activity_id', v_liga_id,
      'wondra1_activity_id', v_wondra1_id,
      'wondra2_activity_id', v_wondra2_id,
      'players', v_players,
      'credit_total', v_credit_total,
      'wondra1_applied', v_wondra1_total,
      'wondra2_applied', v_wondra2_total,
      'leftover_credit', v_leftover_total,
      'note', 'No se modifica el saldo personal por devolver a Consu/Marce'
    ),
    null
  );

  raise notice 'Reasignacion aplicada: % jugadoras, % total, % a Wondra 1, % a Wondra 2.', v_players, v_credit_total, v_wondra1_total, v_wondra2_total;
end;
$$;

notify pgrst, 'reload schema';

commit;

-- Validacion esperada despues de ejecutar:
-- Wondra 1: estas 7 jugadoras deben quedar pagadas.
-- Wondra 2: estas 7 jugadoras deben quedar con diferencial pendiente.
-- Liga invierno colegio Mayor: debe quedar cancelada.
with target_players as (
  select id, coalesce(apodo, nombre) as player_name
  from public.players
  where coalesce(apodo, nombre) in ('Cata', 'Celsa', 'Chica', 'Consu', 'Dani J', 'Marce', 'Pia')
), target_activities as (
  select id, name
  from public.treasury_activities
  where lower(trim(name)) in (
    lower('Liga invierno colegio Mayor'),
    lower('Wondra 1 semestre'),
    lower('Wondra 2 semestre')
  )
)
select
  tp.player_name,
  a.name as activity_name,
  d.status,
  d.assigned_amount,
  d.paid_amount,
  greatest(coalesce(d.assigned_amount, 0) - coalesce(d.paid_amount, 0), 0)::integer as pending_amount
from target_players tp
join public.activity_debts d on d.player_id = tp.id
join target_activities a on a.id = d.activity_id
order by tp.player_name, a.name;

select
  a.name,
  a.administrative_status,
  count(*) filter (where d.status = 'paid')::integer as paid_rows,
  count(*) filter (where d.status = 'pending')::integer as pending_rows,
  count(*) filter (where d.status = 'cancelled')::integer as cancelled_rows,
  coalesce(sum(d.paid_amount), 0)::integer as paid_amount,
  coalesce(sum(greatest(coalesce(d.assigned_amount, 0) - coalesce(d.paid_amount, 0), 0)) filter (where d.status = 'pending'), 0)::integer as pending_amount
from public.treasury_activities a
left join public.activity_debts d on d.activity_id = a.id
where lower(trim(a.name)) in (
  lower('Liga invierno colegio Mayor'),
  lower('Wondra 1 semestre'),
  lower('Wondra 2 semestre')
)
group by a.id, a.name, a.administrative_status
order by a.name;