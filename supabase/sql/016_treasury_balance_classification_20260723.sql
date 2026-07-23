begin;

-- Ajuste de clasificacion 2026-07-23:
-- - Liga Invierno Colegio Mayor queda como caja recibida para una actividad por pagar.
-- - Marce y Consu quedan como saldos personales por devolver, separados del fondo.
-- - La devolucion personal sale por la clase personal_reimbursement.

create or replace function public.treasury_register_personal_reimbursement(
  p_activity_id uuid,
  p_amount integer,
  p_paid_at timestamptz default now(),
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.treasury_activities%rowtype;
  v_movement_id uuid;
  v_original integer := 0;
  v_reimbursed integer := 0;
  v_pending integer := 0;
  v_player_name text := 'jugadora';
begin
  perform public.treasury_assert_writer();

  select id into v_movement_id
  from public.treasury_movements
  where idempotency_key = p_idempotency_key
  limit 1;

  if v_movement_id is not null then
    return jsonb_build_object('movement_id', v_movement_id, 'idempotent', true);
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Monto invalido';
  end if;

  select * into v_activity
  from public.treasury_activities
  where id = p_activity_id
  for update;

  if v_activity.id is null then
    raise exception 'Registro por devolver no encontrado';
  end if;

  if v_activity.payer_player_id is null then
    raise exception 'El registro no tiene persona asociada';
  end if;

  v_original := greatest(coalesce(v_activity.total_cost, 0) - coalesce(v_activity.team_contribution, 0), 0);

  select coalesce(sum(amount), 0)::integer
    into v_reimbursed
  from public.treasury_movements
  where source_table = 'treasury_activities'
    and source_id = v_activity.id
    and movement_type = 'personal_reimbursement_payment'
    and direction = 'out'
    and status = 'posted';

  v_pending := greatest(v_original - v_reimbursed, 0);

  if v_pending <= 0 then
    raise exception 'No hay saldo pendiente para devolver';
  end if;

  if p_amount > v_pending then
    raise exception 'El monto supera el saldo pendiente (%)', v_pending;
  end if;

  select coalesce(apodo, nombre, 'jugadora')
    into v_player_name
  from public.players
  where id = v_activity.payer_player_id;

  v_movement_id := public.treasury_insert_movement(
    'personal_reimbursement_payment',
    'out',
    p_amount,
    'Devolucion a ' || coalesce(v_player_name, 'jugadora') || ': ' || coalesce(v_activity.name, 'Saldo por devolver'),
    'personal_reimbursement',
    'treasury_activities',
    v_activity.id,
    null,
    v_activity.payer_player_id,
    v_activity.payer_player_id,
    coalesce(p_paid_at, now()),
    p_idempotency_key
  );

  update public.treasury_activities
     set administrative_status = case when v_pending - p_amount <= 0 then 'closed' else 'open' end,
         updated_at = now()
   where id = v_activity.id;

  perform public.treasury_log(
    gen_random_uuid()::text,
    p_idempotency_key,
    'personal_reimbursement.paid',
    'treasury_activities',
    v_activity.id,
    jsonb_build_object(
      'amount', p_amount,
      'pending_before', v_pending,
      'pending_after', greatest(v_pending - p_amount, 0),
      'availability_class', 'personal_reimbursement'
    ),
    null
  );

  return jsonb_build_object('movement_id', v_movement_id, 'pending_after', greatest(v_pending - p_amount, 0));
end;
$$;

grant execute on function public.treasury_register_personal_reimbursement(uuid, integer, timestamptz, text) to anon, authenticated, service_role;

with liga_activity as (
  select id
  from public.treasury_activities
  where lower(trim(name)) = lower('Liga invierno colegio Mayor')
), liga_debts as (
  select d.id
  from public.activity_debts d
  join liga_activity a on a.id = d.activity_id
)
update public.treasury_movements m
   set availability_class = 'clearing',
       concept = coalesce(nullif(m.concept, ''), 'Liga invierno colegio Mayor')
where m.status = 'posted'
  and m.direction = 'in'
  and m.movement_type in ('legacy_debt_payment', 'activity_debt_payment')
  and m.source_table = 'activity_debts'
  and m.source_id in (select id from liga_debts);

with liga_activity as (
  select id
  from public.treasury_activities
  where lower(trim(name)) = lower('Liga invierno colegio Mayor')
), liga_debts as (
  select d.id
  from public.activity_debts d
  join liga_activity a on a.id = d.activity_id
)
update public.payment_allocations pa
   set availability_class = 'clearing'
where pa.status = 'posted'
  and pa.target_type = 'activity_debt'
  and pa.target_id in (select id from liga_debts);

update public.treasury_movements
   set availability_class = 'personal_reimbursement'
where status = 'posted'
  and movement_type = 'personal_reimbursement_payment';

update public.treasury_activities
   set notes = 'Liga Wondra 1 semestre: saldo personal pendiente de devolver a Marce.',
       updated_at = now()
where idempotency_key = 'tesorera-closing-20260723-personal-advance-marce';

update public.treasury_activities
   set notes = 'Liga invierno Colegio Mayor: saldo personal pendiente de devolver a Consu.',
       updated_at = now()
where idempotency_key = 'tesorera-closing-20260723-personal-advance-consu';

create or replace view public.treasury_cash_balance as
select coalesce(sum(case when direction = 'in' then amount else -amount end), 0)::integer as cash_balance
from public.treasury_movements
where status = 'posted'
  and movement_type <> 'credit_application';

notify pgrst, 'reload schema';

commit;

select
  'cash_balance' as check_name,
  cash_balance as amount
from public.treasury_cash_balance;

select
  'balance_by_class' as check_name,
  availability_class,
  balance
from public.treasury_balance_by_class
order by availability_class;

select
  'liga_invierno_classification' as check_name,
  m.availability_class,
  count(*)::integer as movement_rows,
  coalesce(sum(case when m.direction = 'in' then m.amount else -m.amount end), 0)::integer as amount
from public.treasury_movements m
join public.activity_debts d on d.id = m.source_id and m.source_table = 'activity_debts'
join public.treasury_activities a on a.id = d.activity_id
where lower(trim(a.name)) = lower('Liga invierno colegio Mayor')
  and m.status = 'posted'
group by m.availability_class
order by m.availability_class;
