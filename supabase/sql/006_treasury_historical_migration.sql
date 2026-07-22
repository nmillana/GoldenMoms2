-- 006_treasury_historical_migration.sql
-- Non-destructive legacy migration into the new Treasury model.
-- Reads legacy tables and inserts traced rows. It never deletes or updates legacy data.
-- Run only after 001 diagnostics and a manual backup/export.

begin;

do $$
declare
  v_batch text := 'legacy-treasury-20260722';
begin
  insert into public.treasury_migration_runs(batch_key, status, notes)
  values (v_batch, 'started', 'Non-destructive migration from fees, fee_payments, expenses, expense_payments, treas_events and treas_event_payments')
  on conflict (batch_key) do update set status='started', started_at=now();

  -- Legacy fees become activity-style charge records. This avoids forcing old arbitrary charges into one monthly fee per player/month.
  insert into public.treasury_activities(
    name, activity_type, activity_date, total_cost, team_contribution, payer_player_id,
    distribution_type, administrative_status, notes, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select
    coalesce(f.title, 'Legacy fee ' || f.id::text), 'otro', coalesce(f.due_date, f.created_at::date),
    round(coalesce((select sum(coalesce(fp.amount, f.amount, 0)) from public.fee_payments fp where fp.fee_id = f.id), coalesce(f.amount,0)))::integer,
    0, null, 'individual', 'open', coalesce(f.team,''),
    v_batch || '-fee-' || f.id::text,
    'fees', f.id::text, v_batch, now()
  from public.fees f
  where not exists (
    select 1 from public.treasury_activities a where a.legacy_source_table='fees' and a.legacy_source_id=f.id::text
  );

  insert into public.activity_debts(
    activity_id, player_id, beneficiary_player_id, assigned_amount, paid_amount, status, paid_at,
    idempotency_key, legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select a.id, fp.player_id, null,
    round(coalesce(fp.amount, f.amount, 0))::integer,
    case when fp.paid is true then round(coalesce(fp.amount, f.amount, 0))::integer else 0 end,
    case when fp.paid is true then 'paid' else 'pending' end,
    fp.paid_at,
    v_batch || '-fee-payment-debt-' || fp.id::text,
    'fee_payments', fp.id::text, v_batch, now()
  from public.fee_payments fp
  join public.fees f on f.id = fp.fee_id
  join public.treasury_activities a on a.legacy_source_table='fees' and a.legacy_source_id=f.id::text
  where not exists (
    select 1 from public.activity_debts d where d.legacy_source_table='fee_payments' and d.legacy_source_id=fp.id::text
  );

  -- Legacy expenses become activities with a real team_fund outgoing movement.
  insert into public.treasury_activities(
    name, activity_type, activity_date, total_cost, team_contribution, payer_player_id,
    distribution_type, administrative_status, notes, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select coalesce(e.title, 'Legacy expense ' || e.id::text), 'materiales', coalesce(e.date, e.created_at::date),
    round(coalesce(e.total_amount,0))::integer, 0, null, 'individual', 'open', coalesce(e.notes, e.team, ''),
    v_batch || '-expense-' || e.id::text,
    'expenses', e.id::text, v_batch, now()
  from public.expenses e
  where not exists (
    select 1 from public.treasury_activities a where a.legacy_source_table='expenses' and a.legacy_source_id=e.id::text
  );

  insert into public.treasury_movements(
    movement_type, direction, amount, concept, effective_date, availability_class,
    source_table, source_id, status, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select 'legacy_expense', 'out', round(coalesce(e.total_amount,0))::integer, coalesce(e.title,'Legacy expense'), coalesce(e.date::timestamptz, e.created_at), 'team_fund',
    'treasury_activities', a.id, 'posted', v_batch || '-expense-movement-' || e.id::text,
    'expenses', e.id::text, v_batch, now()
  from public.expenses e
  join public.treasury_activities a on a.legacy_source_table='expenses' and a.legacy_source_id=e.id::text
  where coalesce(e.total_amount,0) > 0
    and not exists (select 1 from public.treasury_movements m where m.idempotency_key = v_batch || '-expense-movement-' || e.id::text);

  insert into public.activity_debts(
    activity_id, player_id, beneficiary_player_id, assigned_amount, paid_amount, status, paid_at,
    idempotency_key, legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select a.id, ep.player_id, null,
    round(coalesce(ep.amount,0))::integer, case when ep.paid is true then round(coalesce(ep.amount,0))::integer else 0 end,
    case when ep.paid is true then 'paid' else 'pending' end,
    ep.paid_at,
    v_batch || '-expense-payment-debt-' || ep.id::text,
    'expense_payments', ep.id::text, v_batch, now()
  from public.expense_payments ep
  join public.expenses e on e.id = ep.expense_id
  join public.treasury_activities a on a.legacy_source_table='expenses' and a.legacy_source_id=e.id::text
  where not exists (
    select 1 from public.activity_debts d where d.legacy_source_table='expense_payments' and d.legacy_source_id=ep.id::text
  );

  -- Legacy treasurer events become activity-style charge records.
  insert into public.treasury_activities(
    name, activity_type, activity_date, total_cost, team_contribution, payer_player_id,
    distribution_type, administrative_status, notes, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select coalesce(te.title, 'Legacy treasury event ' || te.id::text), 'otro', coalesce(te.date, te.created_at::date),
    round(coalesce((select sum(coalesce(tp.amount, te.amount,0)) from public.treas_event_payments tp where tp.treas_event_id=te.id), coalesce(te.amount,0)))::integer,
    0, null, 'individual', 'open', coalesce(te.notes, te.team, ''),
    v_batch || '-treas-event-' || te.id::text,
    'treas_events', te.id::text, v_batch, now()
  from public.treas_events te
  where not exists (
    select 1 from public.treasury_activities a where a.legacy_source_table='treas_events' and a.legacy_source_id=te.id::text
  );

  insert into public.activity_debts(
    activity_id, player_id, beneficiary_player_id, assigned_amount, paid_amount, status, paid_at,
    idempotency_key, legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select a.id, tp.player_id, null,
    round(coalesce(tp.amount, te.amount,0))::integer, case when tp.paid is true then round(coalesce(tp.amount, te.amount,0))::integer else 0 end,
    case when tp.paid is true then 'paid' else 'pending' end,
    tp.paid_at,
    v_batch || '-treas-event-payment-debt-' || tp.id::text,
    'treas_event_payments', tp.id::text, v_batch, now()
  from public.treas_event_payments tp
  join public.treas_events te on te.id = tp.treas_event_id
  join public.treasury_activities a on a.legacy_source_table='treas_events' and a.legacy_source_id=te.id::text
  where not exists (
    select 1 from public.activity_debts d where d.legacy_source_table='treas_event_payments' and d.legacy_source_id=tp.id::text
  );

  -- Paid migrated debts receive payment records and team_fund incoming movements.
  insert into public.payments(
    payer_player_id, payment_type, amount_received, paid_at, status, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select d.player_id, 'activity_debt', d.assigned_amount, coalesce(d.paid_at, d.created_at), 'posted',
    v_batch || '-payment-' || d.legacy_source_table || '-' || d.legacy_source_id,
    d.legacy_source_table, d.legacy_source_id, v_batch, now()
  from public.activity_debts d
  where d.migration_batch_id = v_batch and d.status='paid'
    and not exists (select 1 from public.payments p where p.idempotency_key = v_batch || '-payment-' || d.legacy_source_table || '-' || d.legacy_source_id);

  insert into public.payment_allocations(
    payment_id, target_type, target_id, player_id, amount, availability_class, status, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select p.id, 'activity_debt', d.id, d.player_id, d.assigned_amount, 'team_fund', 'posted',
    v_batch || '-allocation-' || d.legacy_source_table || '-' || d.legacy_source_id,
    d.legacy_source_table, d.legacy_source_id, v_batch, now()
  from public.activity_debts d
  join public.payments p on p.idempotency_key = v_batch || '-payment-' || d.legacy_source_table || '-' || d.legacy_source_id
  where d.migration_batch_id = v_batch and d.status='paid'
    and not exists (select 1 from public.payment_allocations pa where pa.idempotency_key = v_batch || '-allocation-' || d.legacy_source_table || '-' || d.legacy_source_id);

  insert into public.treasury_movements(
    movement_type, direction, amount, concept, effective_date, availability_class,
    source_table, source_id, payment_id, player_id, status, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select 'legacy_debt_payment', 'in', d.assigned_amount, coalesce(a.name,'Legacy payment'), coalesce(d.paid_at, d.created_at), 'team_fund',
    'activity_debts', d.id, p.id, d.player_id, 'posted',
    v_batch || '-movement-' || d.legacy_source_table || '-' || d.legacy_source_id,
    d.legacy_source_table, d.legacy_source_id, v_batch, now()
  from public.activity_debts d
  join public.treasury_activities a on a.id = d.activity_id
  join public.payments p on p.idempotency_key = v_batch || '-payment-' || d.legacy_source_table || '-' || d.legacy_source_id
  where d.migration_batch_id = v_batch and d.status='paid'
    and not exists (select 1 from public.treasury_movements m where m.idempotency_key = v_batch || '-movement-' || d.legacy_source_table || '-' || d.legacy_source_id);

  update public.treasury_migration_runs
  set status='completed', completed_at=now(), totals=jsonb_build_object(
    'activities', (select count(*) from public.treasury_activities where migration_batch_id=v_batch),
    'debts', (select count(*) from public.activity_debts where migration_batch_id=v_batch),
    'payments', (select count(*) from public.payments where migration_batch_id=v_batch),
    'movements', (select count(*) from public.treasury_movements where migration_batch_id=v_batch)
  )
  where batch_key = v_batch;
end;
$$;

commit;
