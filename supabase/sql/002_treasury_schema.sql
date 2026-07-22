-- 002_treasury_schema.sql
-- Golden Moms - Treasury redesign local-only schema.
-- Prepared only. Do not run before reviewing 001 diagnostics in the real Supabase project.

begin;

create extension if not exists pgcrypto;

create table if not exists public.treasury_settings (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  monthly_fee_amount integer not null check (monthly_fee_amount >= 0),
  dt_amount integer not null check (dt_amount >= 0),
  team_fund_amount integer not null check (team_fund_amount >= 0),
  valid_from date not null default current_date,
  valid_to date,
  is_active boolean not null default true,
  notes text,
  idempotency_key text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz,
  constraint treasury_settings_amounts_match check (monthly_fee_amount = dt_amount + team_fund_amount),
  constraint treasury_settings_valid_range check (valid_to is null or valid_to >= valid_from)
);

create table if not exists public.treasury_income (
  id uuid primary key default gen_random_uuid(),
  income_type text not null default 'other' check (income_type in ('monthly_fee','cdp','prize','sponsor','refund','manual_adjustment','other')),
  concept text not null,
  amount integer not null check (amount > 0),
  expected_date date,
  received_at timestamptz,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','reversed')),
  source text,
  source_player_id uuid references public.players(id) on delete set null,
  notes text,
  idempotency_key text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz
);

create table if not exists public.monthly_fees (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  year integer not null,
  month integer not null check (month between 1 and 12),
  team text not null default 'Golden Moms',
  gross_amount integer not null check (gross_amount >= 0),
  dt_amount integer not null default 0 check (dt_amount >= 0),
  team_fund_amount integer not null default 0 check (team_fund_amount >= 0),
  credit_applied_amount integer not null default 0 check (credit_applied_amount >= 0),
  amount_due integer not null default 0 check (amount_due >= 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled','reversed')),
  due_date date,
  paid_at timestamptz,
  payment_id uuid,
  generated_from_settings_id uuid references public.treasury_settings(id) on delete set null,
  generated_by_user_id uuid,
  notes text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz,
  constraint monthly_fees_amounts_match check (gross_amount = dt_amount + team_fund_amount)
);

create table if not exists public.player_credits (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete restrict,
  origin_type text not null default 'manual_adjustment' check (origin_type in ('monthly_fee_overpayment','activity_advance','manual_adjustment','migration','other')),
  origin_table text,
  origin_id uuid,
  original_amount integer not null check (original_amount > 0),
  remaining_amount integer not null check (remaining_amount >= 0),
  status text not null default 'active' check (status in ('active','used','cancelled','reversed')),
  notes text,
  idempotency_key text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz,
  constraint player_credits_remaining_lte_original check (remaining_amount <= original_amount)
);

create table if not exists public.credit_applications (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.player_credits(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  target_type text not null check (target_type in ('monthly_fee','activity_debt','manual_adjustment')),
  target_id uuid not null,
  amount integer not null check (amount > 0),
  status text not null default 'posted' check (status in ('posted','reversed')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz
);

create table if not exists public.treasury_activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  activity_type text not null default 'otro' check (activity_type in ('campeonato','celebracion','tercer_tiempo','cumpleanos','liga','materiales','otro')),
  activity_date date,
  total_cost integer not null default 0 check (total_cost >= 0),
  team_contribution integer not null default 0 check (team_contribution >= 0),
  payer_player_id uuid references public.players(id) on delete set null,
  distribution_type text not null default 'equal' check (distribution_type in ('equal','individual')),
  administrative_status text not null default 'open' check (administrative_status in ('draft','open','closed','cancelled','reversed')),
  notes text,
  idempotency_key text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz,
  constraint treasury_activities_team_contribution_lte_total check (team_contribution <= total_cost)
);

create table if not exists public.activity_debts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.treasury_activities(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  beneficiary_player_id uuid references public.players(id) on delete set null,
  assigned_amount integer not null check (assigned_amount >= 0),
  paid_amount integer not null default 0 check (paid_amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','no_charge','cancelled','reversed')),
  due_date date,
  paid_at timestamptz,
  payment_id uuid,
  no_charge_reason text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz,
  constraint activity_debts_paid_lte_assigned check (paid_amount <= assigned_amount)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payer_player_id uuid references public.players(id) on delete set null,
  payment_type text not null check (payment_type in ('monthly_fee','activity_debt','income','other')),
  amount_received integer not null check (amount_received >= 0),
  paid_at timestamptz not null default now(),
  method text not null default 'transfer' check (method in ('transfer','cash','other')),
  notes text,
  status text not null default 'posted' check (status in ('posted','reversed')),
  idempotency_key text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz
);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  target_type text not null check (target_type in ('monthly_fee','activity_debt','income','credit','manual_adjustment')),
  target_id uuid not null,
  player_id uuid references public.players(id) on delete set null,
  beneficiary_player_id uuid references public.players(id) on delete set null,
  amount integer not null check (amount > 0),
  availability_class text not null default 'team_fund' check (availability_class in ('team_fund','dt_reserved','personal_reimbursement','player_credit','clearing')),
  status text not null default 'posted' check (status in ('posted','reversed')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz
);

create table if not exists public.treasury_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null,
  direction text not null check (direction in ('in','out')),
  amount integer not null check (amount > 0),
  concept text not null,
  effective_date timestamptz not null default now(),
  availability_class text not null default 'team_fund' check (availability_class in ('team_fund','dt_reserved','personal_reimbursement','player_credit','clearing')),
  player_id uuid references public.players(id) on delete set null,
  beneficiary_player_id uuid references public.players(id) on delete set null,
  source_table text not null,
  source_id uuid,
  payment_id uuid references public.payments(id) on delete set null,
  status text not null default 'posted' check (status in ('posted','reversed')),
  reversing_movement_id uuid references public.treasury_movements(id) on delete set null,
  idempotency_key text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz
);

create table if not exists public.dt_payments (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  amount integer not null check (amount > 0),
  unit_amount integer not null check (unit_amount >= 0),
  fee_count integer not null check (fee_count > 0),
  paid_at timestamptz not null default now(),
  payment_method text not null default 'transfer',
  status text not null default 'posted' check (status in ('posted','reversed')),
  notes text,
  idempotency_key text,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_reason text,
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz
);

create table if not exists public.dt_payment_fees (
  dt_payment_id uuid not null references public.dt_payments(id) on delete restrict,
  monthly_fee_id uuid not null references public.monthly_fees(id) on delete restrict,
  dt_amount integer not null check (dt_amount >= 0),
  created_at timestamptz not null default now(),
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz,
  primary key (dt_payment_id, monthly_fee_id)
);

create table if not exists public.treasury_audit_log (
  id uuid primary key default gen_random_uuid(),
  operation_id text not null,
  idempotency_key text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  actor_user_id uuid,
  actor_role text,
  before_data jsonb,
  after_data jsonb,
  payload jsonb,
  created_at timestamptz not null default now(),
  legacy_source_table text,
  legacy_source_id text,
  migration_batch_id text,
  migrated_at timestamptz
);

create table if not exists public.treasury_migration_runs (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  status text not null default 'started' check (status in ('started','completed','failed','rolled_back')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  totals jsonb not null default '{}'::jsonb,
  notes text
);

create or replace view public.personal_advances as
select
  a.id as activity_id,
  a.name as activity_name,
  d.beneficiary_player_id as player_id,
  sum(d.assigned_amount) filter (where d.status in ('pending','paid'))::integer as original_amount,
  coalesce(sum(d.paid_amount) filter (where d.status = 'paid'),0)::integer as recovered_amount,
  greatest(
    coalesce(sum(d.assigned_amount) filter (where d.status in ('pending','paid')),0) -
    coalesce(sum(d.paid_amount) filter (where d.status = 'paid'),0),
    0
  )::integer as pending_amount,
  min(d.created_at) as created_at
from public.treasury_activities a
join public.activity_debts d on d.activity_id = a.id
where d.beneficiary_player_id is not null
  and d.status in ('pending','paid')
group by a.id, a.name, d.beneficiary_player_id;

comment on table public.treasury_movements is 'Append-only financial ledger. Team available balance must be derived from posted team_fund movements.';
comment on view public.personal_advances is 'Calculated personal advance balances from activity debts assigned to a beneficiary player.';

commit;
