-- 005_treasury_rls.sql
-- Proposed RLS for the new Treasury tables.
-- Prepared only. Validate Supabase Auth/JWT role mapping before execution.
-- Current frontend has a custom login in player_users; this SQL expects a future JWT claim role: admin, capitana or tesorera.
-- Direct financial writes are intentionally not granted to authenticated clients. New writes must go through RPC functions in 004.

begin;

create or replace function public.treasury_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.treasury_current_role() in ('service_role','admin','capitana','tesorera');
$$;

create or replace function public.treasury_can_write()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.treasury_current_role() in ('service_role','admin','capitana','tesorera');
$$;

do $$
declare
  t text;
  tables text[] := array[
    'treasury_settings','treasury_income','monthly_fees','player_credits','credit_applications',
    'treasury_activities','activity_debts','payments','payment_allocations','treasury_movements',
    'dt_payments','dt_payment_fees','treasury_audit_log','treasury_migration_runs'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists treasury_select on public.%I', t);
    execute format('drop policy if exists treasury_insert on public.%I', t);
    execute format('drop policy if exists treasury_update on public.%I', t);
    execute format('drop policy if exists treasury_delete on public.%I', t);
    execute format('create policy treasury_select on public.%I for select to authenticated using (public.treasury_can_read())', t);
  end loop;
end;
$$;

revoke insert, update, delete on public.treasury_settings from anon, authenticated;
revoke insert, update, delete on public.treasury_income from anon, authenticated;
revoke insert, update, delete on public.monthly_fees from anon, authenticated;
revoke insert, update, delete on public.player_credits from anon, authenticated;
revoke insert, update, delete on public.credit_applications from anon, authenticated;
revoke insert, update, delete on public.treasury_activities from anon, authenticated;
revoke insert, update, delete on public.activity_debts from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.payment_allocations from anon, authenticated;
revoke insert, update, delete on public.treasury_movements from anon, authenticated;
revoke insert, update, delete on public.dt_payments from anon, authenticated;
revoke insert, update, delete on public.dt_payment_fees from anon, authenticated;
revoke insert, update, delete on public.treasury_audit_log from anon, authenticated;
revoke insert, update, delete on public.treasury_migration_runs from anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select on public.treasury_settings to authenticated;
grant select on public.treasury_income to authenticated;
grant select on public.monthly_fees to authenticated;
grant select on public.player_credits to authenticated;
grant select on public.credit_applications to authenticated;
grant select on public.treasury_activities to authenticated;
grant select on public.activity_debts to authenticated;
grant select on public.payments to authenticated;
grant select on public.payment_allocations to authenticated;
grant select on public.treasury_movements to authenticated;
grant select on public.dt_payments to authenticated;
grant select on public.dt_payment_fees to authenticated;
grant select on public.treasury_audit_log to authenticated;
grant select on public.treasury_migration_runs to authenticated;
grant select on public.personal_advances to authenticated;
grant select on public.treasury_balance_by_class to authenticated;
grant select on public.treasury_available_balance to authenticated;
grant execute on function public.treasury_can_read() to authenticated, service_role;
grant execute on function public.treasury_can_write() to authenticated, service_role;

commit;
