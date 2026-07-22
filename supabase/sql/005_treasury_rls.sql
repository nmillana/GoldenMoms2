-- 005_treasury_rls.sql
-- RLS for the new Treasury tables.
-- For the current custom login, execute 009_treasury_custom_auth_bridge.sql first.
-- The app sends x-gm-treasury-session on Treasury reads/RPCs; policies resolve role through treasury_current_role().
-- Direct financial writes are intentionally not granted to clients. New writes must go through RPC functions in 004.

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
    execute format('create policy treasury_select on public.%I for select to anon, authenticated using (public.treasury_can_read())', t);
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

do $$
begin
  begin execute 'alter view public.personal_advances set (security_invoker = true)'; exception when others then raise notice 'personal_advances security_invoker not changed: %', sqlerrm; end;
  begin execute 'alter view public.treasury_balance_by_class set (security_invoker = true)'; exception when others then raise notice 'treasury_balance_by_class security_invoker not changed: %', sqlerrm; end;
  begin execute 'alter view public.treasury_available_balance set (security_invoker = true)'; exception when others then raise notice 'treasury_available_balance security_invoker not changed: %', sqlerrm; end;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.treasury_settings to anon, authenticated;
grant select on public.treasury_income to anon, authenticated;
grant select on public.monthly_fees to anon, authenticated;
grant select on public.player_credits to anon, authenticated;
grant select on public.credit_applications to anon, authenticated;
grant select on public.treasury_activities to anon, authenticated;
grant select on public.activity_debts to anon, authenticated;
grant select on public.payments to anon, authenticated;
grant select on public.payment_allocations to anon, authenticated;
grant select on public.treasury_movements to anon, authenticated;
grant select on public.dt_payments to anon, authenticated;
grant select on public.dt_payment_fees to anon, authenticated;
grant select on public.treasury_audit_log to anon, authenticated;
grant select on public.treasury_migration_runs to anon, authenticated;
grant select on public.personal_advances to anon, authenticated;
grant select on public.treasury_balance_by_class to anon, authenticated;
grant select on public.treasury_available_balance to anon, authenticated;
grant execute on function public.treasury_can_read() to anon, authenticated, service_role;
grant execute on function public.treasury_can_write() to anon, authenticated, service_role;

commit;
