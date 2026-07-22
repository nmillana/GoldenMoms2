-- 008_treasury_rollback.sql
-- Non-destructive rollback for a historical migration batch.
-- It does not delete financial information. It inserts compensating movements and marks migrated rows as reversed/cancelled.
-- Usage in Supabase SQL editor before running this file:
--   select set_config('gm.rollback_batch', 'legacy-treasury-20260722', false);

begin;

do $$
declare
  v_batch text := nullif(current_setting('gm.rollback_batch', true), '');
  v_now timestamptz := now();
begin
  if v_batch is null then
    raise exception 'Set gm.rollback_batch before running rollback. Example: select set_config(''gm.rollback_batch'', ''legacy-treasury-20260722'', false);';
  end if;

  insert into public.treasury_movements(
    movement_type, direction, amount, concept, effective_date, availability_class,
    source_table, source_id, payment_id, player_id, beneficiary_player_id,
    status, reversing_movement_id, idempotency_key,
    legacy_source_table, legacy_source_id, migration_batch_id, migrated_at
  )
  select
    'rollback_reversal',
    case when m.direction='in' then 'out' else 'in' end,
    m.amount,
    'Rollback ' || coalesce(m.concept, m.movement_type),
    v_now,
    m.availability_class,
    'treasury_movements',
    m.id,
    m.payment_id,
    m.player_id,
    m.beneficiary_player_id,
    'posted',
    m.id,
    'rollback-' || v_batch || '-' || m.id::text,
    'rollback',
    m.id::text,
    v_batch,
    v_now
  from public.treasury_movements m
  where m.migration_batch_id = v_batch
    and m.status = 'posted'
    and m.movement_type <> 'rollback_reversal'
    and not exists (
      select 1 from public.treasury_movements r
      where r.idempotency_key = 'rollback-' || v_batch || '-' || m.id::text
    );

  update public.payment_allocations
    set status='reversed', reversed_at=v_now, reversal_reason='rollback ' || v_batch
  where migration_batch_id = v_batch and status='posted';

  update public.payments
    set status='reversed', reversed_at=v_now, reversal_reason='rollback ' || v_batch
  where migration_batch_id = v_batch and status='posted';

  update public.activity_debts
    set status = case when status='paid' then 'reversed' else 'cancelled' end,
        updated_at = v_now
  where migration_batch_id = v_batch and status in ('pending','paid');

  update public.treasury_activities
    set administrative_status='cancelled', cancelled_at=v_now, cancellation_reason='rollback ' || v_batch
  where migration_batch_id = v_batch and administrative_status <> 'cancelled';

  update public.treasury_income
    set status='reversed', updated_at=v_now, cancellation_reason='rollback ' || v_batch
  where migration_batch_id = v_batch and status <> 'reversed';

  update public.monthly_fees
    set status='reversed', updated_at=v_now, cancellation_reason='rollback ' || v_batch
  where migration_batch_id = v_batch and status <> 'reversed';

  update public.player_credits
    set status='reversed', updated_at=v_now
  where migration_batch_id = v_batch and status <> 'reversed';

  update public.treasury_migration_runs
    set status='rolled_back', completed_at=v_now,
        totals = coalesce(totals,'{}'::jsonb) || jsonb_build_object('rolled_back_at', v_now)
  where batch_key = v_batch;

  perform public.treasury_log(gen_random_uuid()::text, 'rollback-' || v_batch, 'migration.rollback', 'treasury_migration_runs', null, jsonb_build_object('batch', v_batch), null);
end;
$$;

commit;
