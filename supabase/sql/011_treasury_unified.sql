-- Golden Moms - Tesoreria unificada
-- Ejecutar una vez en Supabase SQL Editor antes de usar division de cuotas y pagos adelantados.
-- No elimina data: primero copia las tablas actuales al schema backup.

begin;

create schema if not exists backup;

create table if not exists backup.gm_fees_before_treasury_20260721 as table public.fees;
create table if not exists backup.gm_fee_payments_before_treasury_20260721 as table public.fee_payments;
create table if not exists backup.gm_expenses_before_treasury_20260721 as table public.expenses;
create table if not exists backup.gm_expense_payments_before_treasury_20260721 as table public.expense_payments;

alter table public.fee_payments
  add column if not exists amount numeric(12,2);

alter table public.fees
  add column if not exists total_amount numeric(12,2),
  add column if not exists split_between_players boolean not null default false,
  add column if not exists advance_player_id uuid references public.players(id) on delete set null,
  add column if not exists advance_total numeric(12,2),
  add column if not exists advance_credit numeric(12,2),
  add column if not exists advance_notes text;

update public.fee_payments fp
set amount = coalesce(f.amount, 0)
from public.fees f
where fp.fee_id = f.id
  and fp.amount is null;

update public.fees f
set total_amount = totals.total_amount
from (
  select
    f2.id,
    case
      when count(fp.player_id) > 0 then coalesce(sum(fp.amount), 0)
      else coalesce(f2.amount, 0)
    end as total_amount
  from public.fees f2
  left join public.fee_payments fp on fp.fee_id = f2.id
  group by f2.id, f2.amount
) totals
where f.id = totals.id
  and f.total_amount is null;

create index if not exists fee_payments_fee_id_idx on public.fee_payments(fee_id);
create index if not exists fee_payments_player_id_idx on public.fee_payments(player_id);
create index if not exists fee_payments_paid_idx on public.fee_payments(paid);
create index if not exists fees_created_at_idx on public.fees(created_at desc);
create index if not exists fees_team_idx on public.fees(team);

create index if not exists expense_payments_expense_id_idx on public.expense_payments(expense_id);
create index if not exists expense_payments_player_id_idx on public.expense_payments(player_id);
create index if not exists expense_payments_paid_idx on public.expense_payments(paid);
create index if not exists expenses_created_at_idx on public.expenses(created_at desc);
create index if not exists expenses_team_idx on public.expenses(team);

commit;