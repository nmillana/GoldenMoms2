-- 007_treasury_validation_queries.sql
-- Validation queries for the prepared Treasury redesign.
-- Run these after 001 diagnostics and after each SQL stage as noted.

-- A) New object presence.
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'treasury_settings','treasury_income','monthly_fees','player_credits','credit_applications',
    'treasury_activities','activity_debts','payments','payment_allocations','treasury_movements',
    'dt_payments','dt_payment_fees','treasury_audit_log','treasury_migration_runs'
  )
order by table_name;

-- B) Team available balance derived only from movements.
select * from public.treasury_available_balance;
select * from public.treasury_balance_by_class order by availability_class;

-- C) Legacy balance approximation from old tables.
with legacy_in as (
  select coalesce(sum(coalesce(fp.amount, f.amount,0)),0) amount
  from public.fee_payments fp join public.fees f on f.id=fp.fee_id
  where fp.paid is true
  union all
  select coalesce(sum(coalesce(ep.amount,0)),0)
  from public.expense_payments ep where ep.paid is true
  union all
  select coalesce(sum(coalesce(tp.amount, te.amount,0)),0)
  from public.treas_event_payments tp join public.treas_events te on te.id=tp.treas_event_id
  where tp.paid is true
), legacy_out as (
  select coalesce(sum(coalesce(total_amount,0)),0) amount from public.expenses
)
select
  (select sum(amount) from legacy_in) as legacy_paid_in,
  (select amount from legacy_out) as legacy_expense_out,
  (select sum(amount) from legacy_in) - (select amount from legacy_out) as legacy_estimated_balance;

-- D) Migrated movement balance for the standard batch.
select
  migration_batch_id,
  coalesce(sum(case when direction='in' then amount else -amount end) filter (where availability_class='team_fund' and status='posted'),0)::integer as migrated_team_fund_balance,
  count(*) as movement_rows
from public.treasury_movements
where migration_batch_id='legacy-treasury-20260722'
group by migration_batch_id;

-- E) Duplicates that must be zero.
select 'monthly_fees_duplicate_active' check_name, player_id::text || '-' || year || '-' || month as key, count(*)
from public.monthly_fees
where status in ('pending','paid')
group by player_id, year, month
having count(*) > 1
union all
select 'dt_payment_duplicate_posted', year::text || '-' || month::text, count(*)
from public.dt_payments
where status='posted'
group by year, month
having count(*) > 1
union all
select 'movement_idempotency_duplicate', idempotency_key, count(*)
from public.treasury_movements
where idempotency_key is not null
group by idempotency_key
having count(*) > 1;

-- F) Negative or incoherent balances that must be zero rows.
select * from public.player_credits where remaining_amount < 0 or remaining_amount > original_amount;
select * from public.activity_debts where paid_amount < 0 or paid_amount > assigned_amount;
select * from public.personal_advances where pending_amount < 0;

-- G) Pending operational queue.
select 'monthly_fee_pending' source, count(*) rows, coalesce(sum(amount_due),0) amount from public.monthly_fees where status='pending'
union all select 'activity_debt_pending', count(*), coalesce(sum(assigned_amount-paid_amount),0) from public.activity_debts where status='pending'
union all select 'income_pending', count(*), coalesce(sum(amount),0) from public.treasury_income where status='pending'
union all select 'personal_advances_pending', count(*), coalesce(sum(pending_amount),0) from public.personal_advances;

-- H) DT pending by period.
select mf.year, mf.month, count(*) fee_count, coalesce(sum(mf.dt_amount),0) dt_pending
from public.monthly_fees mf
where mf.status='paid'
  and not exists (select 1 from public.dt_payment_fees dpf where dpf.monthly_fee_id=mf.id)
group by mf.year, mf.month
order by mf.year desc, mf.month desc;

-- I) RLS policies prepared.
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname='public' and tablename like 'treasury_%'
order by tablename, policyname;

-- J) Audit trail.
select action, entity_type, count(*) rows, max(created_at) last_at
from public.treasury_audit_log
group by action, entity_type
order by last_at desc nulls last;
