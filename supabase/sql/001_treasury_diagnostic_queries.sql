-- 001_treasury_diagnostic_queries.sql
-- Golden Moms - Diagnostico previo Tesoreria local-only
-- Ejecutar primero en Supabase SQL Editor. No modifica datos.

-- 1) Tablas financieras legacy y nuevas esperadas
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'fees','fee_payments','expenses','expense_payments','treas_events','treas_event_payments',
    'treasury_settings','treasury_income','monthly_fees','player_credits','credit_applications',
    'treasury_activities','activity_debts','payments','payment_allocations','personal_advances',
    'treasury_movements','dt_payments','dt_payment_fees','treasury_audit_log','treasury_migration_runs'
  )
order by table_name;

-- 2) Columnas de tablas relevantes
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'players','player_users','fees','fee_payments','expenses','expense_payments','treas_events','treas_event_payments',
    'treasury_settings','treasury_income','monthly_fees','player_credits','credit_applications',
    'treasury_activities','activity_debts','payments','payment_allocations','treasury_movements','dt_payments','dt_payment_fees','treasury_audit_log'
  )
order by table_name, ordinal_position;

-- 3) Conteos legacy
select 'fees' as table_name, count(*) as rows from public.fees
union all select 'fee_payments', count(*) from public.fee_payments
union all select 'expenses', count(*) from public.expenses
union all select 'expense_payments', count(*) from public.expense_payments
union all select 'treas_events', count(*) from public.treas_events
union all select 'treas_event_payments', count(*) from public.treas_event_payments
union all select 'players', count(*) from public.players
union all select 'player_users', count(*) from public.player_users;

-- 4) Totales legacy aproximados para comparar despues
select 'fee_payments_paid' as metric, coalesce(sum(coalesce(fp.amount, f.amount, 0)),0) as amount
from public.fee_payments fp
join public.fees f on f.id = fp.fee_id
where fp.paid is true
union all
select 'fee_payments_pending', coalesce(sum(coalesce(fp.amount, f.amount, 0)),0)
from public.fee_payments fp
join public.fees f on f.id = fp.fee_id
where coalesce(fp.paid,false) is false
union all
select 'expense_total', coalesce(sum(total_amount),0) from public.expenses
union all
select 'expense_payments_paid', coalesce(sum(amount),0) from public.expense_payments where paid is true
union all
select 'treas_event_payments_paid', coalesce(sum(amount),0) from public.treas_event_payments where paid is true;

-- 5) Duplicados legacy que podrian romper migracion idempotente
select 'fee_payments' as table_name, fee_id::text as parent_id, player_id::text, count(*)
from public.fee_payments
group by fee_id, player_id
having count(*) > 1
union all
select 'expense_payments', expense_id::text, player_id::text, count(*)
from public.expense_payments
group by expense_id, player_id
having count(*) > 1
union all
select 'treas_event_payments', treas_event_id::text, player_id::text, count(*)
from public.treas_event_payments
group by treas_event_id, player_id
having count(*) > 1;

-- 6) Roles actuales
select
  coalesce(role,'(sin role)') as player_user_role,
  count(*) as users
from public.player_users
group by coalesce(role,'(sin role)')
order by users desc;

select
  coalesce(rol,'(sin rol)') as player_rol,
  count(*) as players
from public.players
group by coalesce(rol,'(sin rol)')
order by players desc;

-- 7) Estado RLS
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'players','player_users','fees','fee_payments','expenses','expense_payments','treas_events','treas_event_payments',
    'treasury_settings','treasury_income','monthly_fees','player_credits','credit_applications',
    'treasury_activities','activity_debts','payments','payment_allocations','treasury_movements','dt_payments','dt_payment_fees','treasury_audit_log'
  )
order by c.relname;

-- 8) Politicas vigentes
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'players','player_users','fees','fee_payments','expenses','expense_payments','treas_events','treas_event_payments',
    'treasury_settings','treasury_income','monthly_fees','player_credits','credit_applications',
    'treasury_activities','activity_debts','payments','payment_allocations','treasury_movements','dt_payments','dt_payment_fees','treasury_audit_log'
  )
order by tablename, policyname;

-- 9) Funciones/RPC treasury existentes
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'treasury_%'
order by p.proname;

-- 10) Muestra legacy para validar mapeo historico manualmente
select * from public.fees order by created_at desc nulls last limit 20;
select * from public.expenses order by created_at desc nulls last limit 20;
select * from public.treas_events order by created_at desc nulls last limit 20;
