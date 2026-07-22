-- 003_treasury_constraints.sql
-- Indexes, uniqueness and helper views for the local-only treasury model.
-- Prepared only. Review diagnostics before executing in Supabase.

begin;

create unique index if not exists treasury_settings_active_year_uidx
  on public.treasury_settings(year)
  where is_active is true;

create unique index if not exists monthly_fees_player_period_active_uidx
  on public.monthly_fees(player_id, year, month)
  where status in ('pending','paid');

create unique index if not exists dt_payments_period_posted_uidx
  on public.dt_payments(year, month)
  where status = 'posted';

create unique index if not exists dt_payment_fees_monthly_fee_uidx
  on public.dt_payment_fees(monthly_fee_id);

create unique index if not exists activity_debts_activity_player_active_uidx
  on public.activity_debts(activity_id, player_id)
  where status in ('pending','paid');

create unique index if not exists treasury_settings_idempotency_uidx on public.treasury_settings(idempotency_key) where idempotency_key is not null;
create unique index if not exists treasury_income_idempotency_uidx on public.treasury_income(idempotency_key) where idempotency_key is not null;
create unique index if not exists monthly_fees_idempotency_uidx on public.monthly_fees(idempotency_key) where idempotency_key is not null;
create unique index if not exists player_credits_idempotency_uidx on public.player_credits(idempotency_key) where idempotency_key is not null;
create unique index if not exists credit_applications_idempotency_uidx on public.credit_applications(idempotency_key) where idempotency_key is not null;
create unique index if not exists treasury_activities_idempotency_uidx on public.treasury_activities(idempotency_key) where idempotency_key is not null;
create unique index if not exists activity_debts_idempotency_uidx on public.activity_debts(idempotency_key) where idempotency_key is not null;
create unique index if not exists payments_idempotency_uidx on public.payments(idempotency_key) where idempotency_key is not null;
create unique index if not exists payment_allocations_idempotency_uidx on public.payment_allocations(idempotency_key) where idempotency_key is not null;
create unique index if not exists treasury_movements_idempotency_uidx on public.treasury_movements(idempotency_key) where idempotency_key is not null;
create unique index if not exists dt_payments_idempotency_uidx on public.dt_payments(idempotency_key) where idempotency_key is not null;
create unique index if not exists treasury_audit_idempotency_uidx on public.treasury_audit_log(idempotency_key) where idempotency_key is not null;

create index if not exists treasury_income_status_idx on public.treasury_income(status, created_at desc);
create index if not exists monthly_fees_period_idx on public.monthly_fees(year desc, month desc, status);
create index if not exists monthly_fees_player_idx on public.monthly_fees(player_id, status);
create index if not exists player_credits_player_status_idx on public.player_credits(player_id, status);
create index if not exists treasury_activities_status_idx on public.treasury_activities(administrative_status, created_at desc);
create index if not exists activity_debts_activity_idx on public.activity_debts(activity_id, status);
create index if not exists activity_debts_player_idx on public.activity_debts(player_id, status);
create index if not exists activity_debts_beneficiary_idx on public.activity_debts(beneficiary_player_id, status);
create index if not exists payments_paid_at_idx on public.payments(paid_at desc);
create index if not exists payment_allocations_payment_idx on public.payment_allocations(payment_id);
create index if not exists treasury_movements_effective_idx on public.treasury_movements(effective_date desc);
create index if not exists treasury_movements_source_idx on public.treasury_movements(source_table, source_id);
create index if not exists treasury_movements_availability_idx on public.treasury_movements(availability_class, status);
create index if not exists treasury_audit_created_idx on public.treasury_audit_log(created_at desc);

create index if not exists monthly_fees_legacy_idx on public.monthly_fees(legacy_source_table, legacy_source_id) where legacy_source_table is not null;
create index if not exists treasury_activities_legacy_idx on public.treasury_activities(legacy_source_table, legacy_source_id) where legacy_source_table is not null;
create index if not exists activity_debts_legacy_idx on public.activity_debts(legacy_source_table, legacy_source_id) where legacy_source_table is not null;
create index if not exists payments_legacy_idx on public.payments(legacy_source_table, legacy_source_id) where legacy_source_table is not null;
create index if not exists treasury_movements_legacy_idx on public.treasury_movements(legacy_source_table, legacy_source_id) where legacy_source_table is not null;

create or replace function public.treasury_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists treasury_settings_touch_updated_at on public.treasury_settings;
create trigger treasury_settings_touch_updated_at before update on public.treasury_settings for each row execute function public.treasury_touch_updated_at();

drop trigger if exists treasury_income_touch_updated_at on public.treasury_income;
create trigger treasury_income_touch_updated_at before update on public.treasury_income for each row execute function public.treasury_touch_updated_at();

drop trigger if exists monthly_fees_touch_updated_at on public.monthly_fees;
create trigger monthly_fees_touch_updated_at before update on public.monthly_fees for each row execute function public.treasury_touch_updated_at();

drop trigger if exists player_credits_touch_updated_at on public.player_credits;
create trigger player_credits_touch_updated_at before update on public.player_credits for each row execute function public.treasury_touch_updated_at();

drop trigger if exists treasury_activities_touch_updated_at on public.treasury_activities;
create trigger treasury_activities_touch_updated_at before update on public.treasury_activities for each row execute function public.treasury_touch_updated_at();

drop trigger if exists activity_debts_touch_updated_at on public.activity_debts;
create trigger activity_debts_touch_updated_at before update on public.activity_debts for each row execute function public.treasury_touch_updated_at();

create or replace view public.treasury_balance_by_class as
select
  availability_class,
  coalesce(sum(case when direction = 'in' then amount else -amount end) filter (where status = 'posted'),0)::integer as balance
from public.treasury_movements
group by availability_class;

create or replace view public.treasury_available_balance as
select coalesce(sum(case when direction = 'in' then amount else -amount end),0)::integer as available_balance
from public.treasury_movements
where status = 'posted'
  and availability_class = 'team_fund';

commit;
