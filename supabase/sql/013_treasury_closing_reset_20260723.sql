-- Corte Tesoreria 2026-07-23
-- Objetivo:
-- - Neutralizar el historico financiero sin borrar filas.
-- - Mantener intacta la actividad "Liga invierno colegio Mayor".
-- - Registrar saldos actuales: le debemos a Marce $102.857 y a Consu $47.143.
-- - Registrar a Janga con cuota pagada de agosto y septiembre 2026.
--
-- Idempotente: puede ejecutarse mas de una vez sin duplicar los registros del corte.
-- Si algun nombre no existe o aparece duplicado, el script falla antes de cambiar datos.

begin;

create temp table gm_treasury_reset_protected_activity_ids(
  id uuid primary key
) on commit drop;

insert into gm_treasury_reset_protected_activity_ids(id)
select id
from public.treasury_activities
where lower(trim(name)) = lower('Liga invierno colegio Mayor')
on conflict do nothing;

create temp table gm_treasury_reset_protected_debt_ids(
  id uuid primary key
) on commit drop;

insert into gm_treasury_reset_protected_debt_ids(id)
select d.id
from public.activity_debts d
join gm_treasury_reset_protected_activity_ids a on a.id = d.activity_id
on conflict do nothing;

create temp table gm_treasury_reset_protected_payment_ids(
  id uuid primary key
) on commit drop;

insert into gm_treasury_reset_protected_payment_ids(id)
select d.payment_id
from public.activity_debts d
join gm_treasury_reset_protected_debt_ids pd on pd.id = d.id
where d.payment_id is not null
on conflict do nothing;

insert into gm_treasury_reset_protected_payment_ids(id)
select pa.payment_id
from public.payment_allocations pa
join gm_treasury_reset_protected_debt_ids d on d.id = pa.target_id
where pa.target_type = 'activity_debt'
on conflict do nothing;

insert into gm_treasury_reset_protected_payment_ids(id)
select m.payment_id
from public.treasury_movements m
where m.payment_id is not null
  and (
    (m.source_table = 'treasury_activities' and exists (
      select 1 from gm_treasury_reset_protected_activity_ids a where a.id = m.source_id
    ))
    or
    (m.source_table = 'activity_debts' and exists (
      select 1 from gm_treasury_reset_protected_debt_ids d where d.id = m.source_id
    ))
  )
on conflict do nothing;

insert into public.treasury_migration_runs(batch_key, status, notes)
values (
  'tesorera-closing-20260723',
  'started',
  'Corte solicitado por tesorera: historico neutralizado, Liga invierno protegida, saldos Marce/Consu y cuotas Janga ago/sep 2026.'
)
on conflict (batch_key) do update
set status = 'started',
    notes = excluded.notes;

do $$
declare
  v_batch text := 'tesorera-closing-20260723';
  v_reason text := 'Corte tesorera 2026-07-23: historico neutralizado sin eliminacion fisica';
  v_now timestamptz := now();
  v_year integer := 2026;
  v_marce_id uuid;
  v_consu_id uuid;
  v_janga_id uuid;
  v_count integer;
  v_setting public.treasury_settings%rowtype;
  v_month integer;
  v_fee_id uuid;
  v_payment_id uuid;
  v_rows integer;
  v_reversed_movements integer := 0;
  v_reversed_allocations integer := 0;
  v_reversed_payments integer := 0;
  v_reset_fees integer := 0;
  v_reset_incomes integer := 0;
  v_reset_debts integer := 0;
  v_reset_activities integer := 0;
  v_reset_dt_payments integer := 0;
  v_reset_credits integer := 0;
  v_reset_credit_apps integer := 0;
begin
  select count(*), (array_agg(id order by id))[1]
    into v_count, v_marce_id
  from public.players
  where lower(trim(coalesce(apodo,''))) = 'marce'
     or lower(trim(coalesce(nombre,''))) = 'marce';
  if v_count <> 1 then
    raise exception 'No se puede resolver Marce de forma unica. Coincidencias: %', v_count;
  end if;

  select count(*), (array_agg(id order by id))[1]
    into v_count, v_consu_id
  from public.players
  where lower(trim(coalesce(apodo,''))) = 'consu'
     or lower(trim(coalesce(nombre,''))) = 'consu';
  if v_count <> 1 then
    raise exception 'No se puede resolver Consu de forma unica. Coincidencias: %', v_count;
  end if;

  select count(*), (array_agg(id order by id))[1]
    into v_count, v_janga_id
  from public.players
  where lower(trim(coalesce(apodo,''))) = 'janga'
     or lower(trim(coalesce(nombre,''))) = 'janga';
  if v_count <> 1 then
    raise exception 'No se puede resolver Janga de forma unica. Coincidencias: %', v_count;
  end if;

  select count(*) into v_count from gm_treasury_reset_protected_activity_ids;
  if v_count < 1 then
    raise exception 'No se encontro la actividad protegida "Liga invierno colegio Mayor". No se aplico el corte.';
  end if;

  select * into v_setting
  from public.treasury_active_setting(v_year);
  if v_setting.id is null then
    raise exception 'No existe configuracion anual activa para %. Crea/activa la configuracion antes de registrar cuotas de Janga.', v_year;
  end if;

  update public.treasury_movements m
     set status = 'reversed',
         reversed_at = coalesce(m.reversed_at, v_now),
         reversal_reason = coalesce(m.reversal_reason, v_reason)
   where m.status = 'posted'
     and coalesce(m.migration_batch_id,'') <> v_batch
     and not exists (
       select 1
       from gm_treasury_reset_protected_activity_ids a
       where m.source_table = 'treasury_activities'
         and a.id = m.source_id
     )
     and not exists (
       select 1
       from gm_treasury_reset_protected_debt_ids d
       where m.source_table = 'activity_debts'
         and d.id = m.source_id
     )
     and not exists (
       select 1
       from gm_treasury_reset_protected_payment_ids p
       where p.id = m.payment_id
     );
  get diagnostics v_rows = row_count;
  v_reversed_movements := v_rows;

  update public.payment_allocations pa
     set status = 'reversed',
         reversed_at = coalesce(pa.reversed_at, v_now),
         reversal_reason = coalesce(pa.reversal_reason, v_reason)
   where pa.status = 'posted'
     and coalesce(pa.migration_batch_id,'') <> v_batch
     and not exists (
       select 1
       from gm_treasury_reset_protected_payment_ids p
       where p.id = pa.payment_id
     )
     and not (
       pa.target_type = 'activity_debt'
       and exists (
         select 1 from gm_treasury_reset_protected_debt_ids d where d.id = pa.target_id
       )
     );
  get diagnostics v_rows = row_count;
  v_reversed_allocations := v_rows;

  update public.payments p
     set status = 'reversed',
         reversed_at = coalesce(p.reversed_at, v_now),
         reversal_reason = coalesce(p.reversal_reason, v_reason)
   where p.status = 'posted'
     and coalesce(p.migration_batch_id,'') <> v_batch
     and not exists (
       select 1
       from gm_treasury_reset_protected_payment_ids pp
       where pp.id = p.id
     );
  get diagnostics v_rows = row_count;
  v_reversed_payments := v_rows;

  update public.monthly_fees mf
     set status = case when mf.status = 'paid' then 'reversed' else 'cancelled' end,
         amount_due = 0,
         cancelled_at = coalesce(mf.cancelled_at, v_now),
         cancellation_reason = coalesce(mf.cancellation_reason, v_reason)
   where mf.status in ('pending','paid')
     and coalesce(mf.migration_batch_id,'') <> v_batch;
  get diagnostics v_rows = row_count;
  v_reset_fees := v_rows;

  update public.treasury_income ti
     set status = case when ti.status = 'confirmed' then 'reversed' else 'cancelled' end,
         cancelled_at = coalesce(ti.cancelled_at, v_now),
         cancellation_reason = coalesce(ti.cancellation_reason, v_reason)
   where ti.status in ('pending','confirmed')
     and coalesce(ti.migration_batch_id,'') <> v_batch;
  get diagnostics v_rows = row_count;
  v_reset_incomes := v_rows;

  update public.activity_debts d
     set status = case when d.status = 'paid' then 'reversed' else 'cancelled' end,
         no_charge_reason = coalesce(d.no_charge_reason, v_reason)
   where d.status in ('pending','paid','no_charge')
     and coalesce(d.migration_batch_id,'') <> v_batch
     and not exists (
       select 1
       from gm_treasury_reset_protected_debt_ids pd
       where pd.id = d.id
     );
  get diagnostics v_rows = row_count;
  v_reset_debts := v_rows;

  update public.treasury_activities a
     set administrative_status = case
           when exists (
             select 1
             from public.activity_debts d
             where d.activity_id = a.id and d.status = 'reversed'
           ) then 'reversed'
           else 'cancelled'
         end,
         cancelled_at = coalesce(a.cancelled_at, v_now),
         cancellation_reason = coalesce(a.cancellation_reason, v_reason)
   where a.administrative_status not in ('cancelled','reversed')
     and coalesce(a.migration_batch_id,'') <> v_batch
     and not exists (
       select 1
       from gm_treasury_reset_protected_activity_ids pa
       where pa.id = a.id
     );
  get diagnostics v_rows = row_count;
  v_reset_activities := v_rows;

  update public.dt_payments dp
     set status = 'reversed',
         reversed_at = coalesce(dp.reversed_at, v_now),
         reversal_reason = coalesce(dp.reversal_reason, v_reason)
   where dp.status = 'posted'
     and coalesce(dp.migration_batch_id,'') <> v_batch;
  get diagnostics v_rows = row_count;
  v_reset_dt_payments := v_rows;

  update public.credit_applications ca
     set status = 'reversed',
         reversed_at = coalesce(ca.reversed_at, v_now),
         reversal_reason = coalesce(ca.reversal_reason, v_reason)
   where ca.status = 'posted'
     and coalesce(ca.migration_batch_id,'') <> v_batch;
  get diagnostics v_rows = row_count;
  v_reset_credit_apps := v_rows;

  update public.player_credits pc
     set status = 'reversed',
         remaining_amount = 0
   where pc.status in ('active','used')
     and coalesce(pc.migration_batch_id,'') <> v_batch;
  get diagnostics v_rows = row_count;
  v_reset_credits := v_rows;

  insert into public.treasury_activities(
    name, activity_type, activity_date, total_cost, team_contribution, payer_player_id,
    distribution_type, administrative_status, notes, idempotency_key,
    migration_batch_id, migrated_at
  )
  values
    ('Saldo por devolver a Marce', 'otro', current_date, 102857, 0, v_marce_id,
     'individual', 'open', 'Corte tesorera 2026-07-23: le debemos a Marce $102.857',
     v_batch || '-personal-advance-marce', v_batch, v_now),
    ('Saldo por devolver a Consu', 'otro', current_date, 47143, 0, v_consu_id,
     'individual', 'open', 'Corte tesorera 2026-07-23: le debemos a Consu $47.143',
     v_batch || '-personal-advance-consu', v_batch, v_now)
  on conflict do nothing;

  foreach v_month in array array[8,9] loop
    select mf.id into v_fee_id
    from public.monthly_fees mf
    where mf.player_id = v_janga_id
      and mf.year = v_year
      and mf.month = v_month
      and mf.status in ('pending','paid')
    order by mf.created_at desc, mf.id
    limit 1;

    if v_fee_id is null then
      insert into public.monthly_fees(
        player_id, year, month, team, gross_amount, dt_amount, team_fund_amount,
        credit_applied_amount, amount_due, status, due_date, generated_from_settings_id,
        notes, idempotency_key, migration_batch_id, migrated_at
      )
      values (
        v_janga_id, v_year, v_month, 'Golden Moms',
        v_setting.monthly_fee_amount, v_setting.dt_amount, v_setting.team_fund_amount,
        0, 0, 'paid', make_date(v_year, v_month, 1), v_setting.id,
        'Corte tesorera 2026-07-23: Janga ya pago esta cuota.',
        v_batch || '-janga-fee-' || v_year::text || '-' || lpad(v_month::text, 2, '0'),
        v_batch, v_now
      )
      returning id into v_fee_id;
    end if;

    select p.id into v_payment_id
    from public.payments p
    where p.idempotency_key = v_batch || '-janga-payment-' || v_year::text || '-' || lpad(v_month::text, 2, '0')
    limit 1;

    if v_payment_id is null then
      insert into public.payments(
        payer_player_id, payment_type, amount_received, paid_at, method, notes, status,
        idempotency_key, migration_batch_id, migrated_at
      )
      values (
        v_janga_id, 'monthly_fee', v_setting.monthly_fee_amount, v_now, 'transfer',
        'Corte tesorera 2026-07-23: cuota pagada por Janga.',
        'posted',
        v_batch || '-janga-payment-' || v_year::text || '-' || lpad(v_month::text, 2, '0'),
        v_batch, v_now
      )
      returning id into v_payment_id;
    end if;

    update public.monthly_fees
       set team = 'Golden Moms',
           gross_amount = v_setting.monthly_fee_amount,
           dt_amount = v_setting.dt_amount,
           team_fund_amount = v_setting.team_fund_amount,
           credit_applied_amount = 0,
           amount_due = 0,
           status = 'paid',
           paid_at = coalesce(paid_at, v_now),
           payment_id = v_payment_id,
           generated_from_settings_id = coalesce(generated_from_settings_id, v_setting.id),
           notes = coalesce(notes, 'Corte tesorera 2026-07-23: Janga ya pago esta cuota.'),
           idempotency_key = coalesce(idempotency_key, v_batch || '-janga-fee-' || v_year::text || '-' || lpad(v_month::text, 2, '0')),
           migration_batch_id = v_batch,
           migrated_at = coalesce(migrated_at, v_now)
     where id = v_fee_id;

    insert into public.treasury_movements(
      movement_type, direction, amount, concept, effective_date, availability_class,
      source_table, source_id, payment_id, player_id, beneficiary_player_id,
      status, idempotency_key, migration_batch_id, migrated_at
    )
    values (
      'monthly_fee_team_fund', 'in', v_setting.team_fund_amount,
      'Cuota fondo equipo ' || lpad(v_month::text, 2, '0') || '/' || v_year::text || ' - Janga',
      v_now, 'team_fund', 'monthly_fees', v_fee_id, v_payment_id, v_janga_id, null,
      'posted',
      v_batch || '-janga-team-fund-' || v_year::text || '-' || lpad(v_month::text, 2, '0'),
      v_batch, v_now
    )
    on conflict do nothing;

    insert into public.treasury_movements(
      movement_type, direction, amount, concept, effective_date, availability_class,
      source_table, source_id, payment_id, player_id, beneficiary_player_id,
      status, idempotency_key, migration_batch_id, migrated_at
    )
    values (
      'monthly_fee_dt_reserved', 'in', v_setting.dt_amount,
      'Reserva DT ' || lpad(v_month::text, 2, '0') || '/' || v_year::text || ' - Janga',
      v_now, 'dt_reserved', 'monthly_fees', v_fee_id, v_payment_id, v_janga_id, null,
      'posted',
      v_batch || '-janga-dt-reserved-' || v_year::text || '-' || lpad(v_month::text, 2, '0'),
      v_batch, v_now
    )
    on conflict do nothing;
  end loop;

  insert into public.treasury_audit_log(
    operation_id, idempotency_key, action, entity_type, payload, migration_batch_id, migrated_at
  )
  values (
    gen_random_uuid()::text,
    v_batch || '-audit',
    'treasury_closing_reset.applied',
    'treasury_migration_runs',
    jsonb_build_object(
      'batch', v_batch,
      'protected_activity', 'Liga invierno colegio Mayor',
      'personal_advances', jsonb_build_array(
        jsonb_build_object('player','Marce','amount',102857),
        jsonb_build_object('player','Consu','amount',47143)
      ),
      'janga_paid_months', jsonb_build_array('2026-08','2026-09'),
      'reversed_movements', v_reversed_movements,
      'reversed_allocations', v_reversed_allocations,
      'reversed_payments', v_reversed_payments,
      'reset_fees', v_reset_fees,
      'reset_incomes', v_reset_incomes,
      'reset_debts', v_reset_debts,
      'reset_activities', v_reset_activities,
      'reset_dt_payments', v_reset_dt_payments,
      'reset_credits', v_reset_credits,
      'reset_credit_applications', v_reset_credit_apps
    ),
    v_batch,
    v_now
  )
  on conflict do nothing;

  update public.treasury_migration_runs
     set status = 'completed',
         completed_at = v_now,
         totals = jsonb_build_object(
           'protected_liga_activities', (select count(*) from gm_treasury_reset_protected_activity_ids),
           'protected_liga_debts', (select count(*) from gm_treasury_reset_protected_debt_ids),
           'protected_liga_payments', (select count(*) from gm_treasury_reset_protected_payment_ids),
           'personal_advance_activities', (
             select count(*)
             from public.treasury_activities
             where migration_batch_id = v_batch
               and idempotency_key in (v_batch || '-personal-advance-marce', v_batch || '-personal-advance-consu')
           ),
           'janga_paid_fees', (
             select count(*)
             from public.monthly_fees
             where migration_batch_id = v_batch
               and player_id = v_janga_id
               and year = v_year
               and month in (8,9)
               and status = 'paid'
           ),
           'reversed_movements', v_reversed_movements,
           'reversed_allocations', v_reversed_allocations,
           'reversed_payments', v_reversed_payments,
           'reset_fees', v_reset_fees,
           'reset_incomes', v_reset_incomes,
           'reset_debts', v_reset_debts,
           'reset_activities', v_reset_activities,
           'reset_dt_payments', v_reset_dt_payments,
           'reset_credits', v_reset_credits,
           'reset_credit_applications', v_reset_credit_apps
         )
   where batch_key = v_batch;
end;
$$;

commit;

-- Validaciones rapidas despues del corte.
select 'available_balance' as check_name, available_balance::integer as amount
from public.treasury_available_balance;

select
  'liga_invierno_colegio_mayor' as check_name,
  a.name,
  count(d.id)::integer as assigned_players,
  count(*) filter (where d.status = 'paid')::integer as paid_players,
  count(*) filter (where d.status = 'pending')::integer as pending_players,
  coalesce(sum(d.assigned_amount) filter (where d.status = 'paid'),0)::integer as paid_amount,
  coalesce(sum(d.assigned_amount) filter (where d.status = 'pending'),0)::integer as pending_amount
from public.treasury_activities a
left join public.activity_debts d on d.activity_id = a.id
where lower(trim(a.name)) = lower('Liga invierno colegio Mayor')
group by a.id, a.name
order by a.name;

select
  'personal_advances_current' as check_name,
  coalesce(p.apodo, p.nombre, 'Sin nombre') as player,
  a.total_cost::integer as amount,
  a.administrative_status
from public.treasury_activities a
left join public.players p on p.id = a.payer_player_id
where a.migration_batch_id = 'tesorera-closing-20260723'
  and a.idempotency_key in (
    'tesorera-closing-20260723-personal-advance-marce',
    'tesorera-closing-20260723-personal-advance-consu'
  )
order by player;

select
  'janga_paid_fees' as check_name,
  coalesce(p.apodo, p.nombre, 'Sin nombre') as player,
  mf.year,
  mf.month,
  mf.gross_amount::integer,
  mf.dt_amount::integer,
  mf.team_fund_amount::integer,
  mf.status
from public.monthly_fees mf
join public.players p on p.id = mf.player_id
where mf.migration_batch_id = 'tesorera-closing-20260723'
  and lower(coalesce(p.apodo, p.nombre, '')) = 'janga'
  and mf.year = 2026
  and mf.month in (8,9)
order by mf.month;

select batch_key, status, totals
from public.treasury_migration_runs
where batch_key = 'tesorera-closing-20260723';
