-- Eliminacion definitiva de historico irrelevante de Tesoreria - 2026-07-23
--
-- ATENCION: este script borra fisicamente informacion. Ejecutar solo si estas segura.
-- Titulos eliminados:
-- - Cuota Mayo 2. 0
-- - Tercer tiempo 26-03
-- - Fuente La Reina 07-05 Cumple Jean
-- - Cuota Abril 2026
--
-- Proteccion: no elimina nada cuyo titulo sea Liga invierno colegio Mayor.
-- Idempotente: si se ejecuta una segunda vez, no deberia borrar filas adicionales.

do $$
declare
  v_titles text[] := array[
    'cuota mayo 2. 0',
    'cuota mayo 2.0',
    'tercer tiempo 26-03',
    'fuente la reina 07-05 cumple jean',
    'fuente la reina 07 -05 cumple jean',
    'cuota abril 2026',
    'cuoata abril 2026'
  ];
  v_title_patterns text[] := array[
    '%cuota mayo 2%',
    '%tercer tiempo 26-03%',
    '%fuente la reina 07-05 cumple jean%',
    '%fuente la reina 07 -05 cumple jean%',
    '%cuota abril 2026%',
    '%cuoata abril 2026%'
  ];
  v_legacy_fee_ids uuid[] := array[]::uuid[];
  v_legacy_fee_payment_ids uuid[] := array[]::uuid[];
  v_activity_ids uuid[] := array[]::uuid[];
  v_debt_ids uuid[] := array[]::uuid[];
  v_payment_ids uuid[] := array[]::uuid[];
  v_movement_ids uuid[] := array[]::uuid[];
  v_credit_app_ids uuid[] := array[]::uuid[];
  v_credit_ids uuid[] := array[]::uuid[];
  v_backup_20260722_fee_ids uuid[] := array[]::uuid[];
  v_backup_20260721_fee_ids uuid[] := array[]::uuid[];
begin
  select coalesce(array_agg(f.id), array[]::uuid[])
    into v_legacy_fee_ids
  from public.fees f
  where lower(regexp_replace(trim(coalesce(f.title,'')), '\s+', ' ', 'g')) = any(v_titles);

  if exists (
    select 1
    from public.fees f
    where f.id = any(v_legacy_fee_ids)
      and lower(regexp_replace(trim(coalesce(f.title,'')), '\s+', ' ', 'g')) = 'liga invierno colegio mayor'
  ) then
    raise exception 'Proteccion activa: el conjunto a eliminar incluye Liga invierno colegio Mayor';
  end if;

  select coalesce(array_agg(fp.id), array[]::uuid[])
    into v_legacy_fee_payment_ids
  from public.fee_payments fp
  where fp.fee_id = any(v_legacy_fee_ids);

  select coalesce(array_agg(a.id), array[]::uuid[])
    into v_activity_ids
  from public.treasury_activities a
  where lower(regexp_replace(trim(coalesce(a.name,'')), '\s+', ' ', 'g')) = any(v_titles)
     or (a.legacy_source_table = 'fees' and a.legacy_source_id = any(
       select unnest(v_legacy_fee_ids)::text
     ));

  if exists (
    select 1
    from public.treasury_activities a
    where a.id = any(v_activity_ids)
      and lower(regexp_replace(trim(coalesce(a.name,'')), '\s+', ' ', 'g')) = 'liga invierno colegio mayor'
  ) then
    raise exception 'Proteccion activa: el conjunto a eliminar incluye Liga invierno colegio Mayor';
  end if;

  select coalesce(array_agg(d.id), array[]::uuid[])
    into v_debt_ids
  from public.activity_debts d
  where d.activity_id = any(v_activity_ids)
     or (d.legacy_source_table = 'fee_payments' and d.legacy_source_id = any(
       select unnest(v_legacy_fee_payment_ids)::text
     ));

  select coalesce(array_agg(distinct payment_id), array[]::uuid[])
    into v_payment_ids
  from (
    select d.payment_id
    from public.activity_debts d
    where d.id = any(v_debt_ids) and d.payment_id is not null
    union
    select pa.payment_id
    from public.payment_allocations pa
    where pa.target_type = 'activity_debt' and pa.target_id = any(v_debt_ids)
    union
    select m.payment_id
    from public.treasury_movements m
    where m.payment_id is not null
      and (
        (m.source_table = 'activity_debts' and coalesce(m.source_id = any(v_debt_ids), false))
        or (m.source_table = 'treasury_activities' and coalesce(m.source_id = any(v_activity_ids), false))
      )
    union
    select p.id
    from public.payments p
    where p.legacy_source_table = 'fee_payments'
      and p.legacy_source_id = any(select unnest(v_legacy_fee_payment_ids)::text)
  ) ids
  where payment_id is not null;

  select coalesce(array_agg(m.id), array[]::uuid[])
    into v_movement_ids
  from public.treasury_movements m
  where (m.source_table = 'activity_debts' and coalesce(m.source_id = any(v_debt_ids), false))
     or (m.source_table = 'treasury_activities' and coalesce(m.source_id = any(v_activity_ids), false))
     or coalesce(m.payment_id = any(v_payment_ids), false)
     or (m.legacy_source_table = 'fee_payments' and m.legacy_source_id = any(select unnest(v_legacy_fee_payment_ids)::text))
     or (m.legacy_source_table = 'fees' and m.legacy_source_id = any(select unnest(v_legacy_fee_ids)::text));

  select coalesce(array_agg(ca.id), array[]::uuid[])
    into v_credit_app_ids
  from public.credit_applications ca
  where ca.target_type = 'activity_debt'
    and ca.target_id = any(v_debt_ids);

  select coalesce(array_agg(distinct credit_id), array[]::uuid[])
    into v_credit_ids
  from public.credit_applications ca
  where ca.id = any(v_credit_app_ids);

  v_credit_ids := v_credit_ids || coalesce((
    select array_agg(pc.id)
    from public.player_credits pc
    where (pc.origin_table = 'payments' and coalesce(pc.origin_id = any(v_payment_ids), false))
       or (pc.origin_table = 'activity_debts' and coalesce(pc.origin_id = any(v_debt_ids), false))
       or (pc.origin_table = 'treasury_activities' and coalesce(pc.origin_id = any(v_activity_ids), false))
  ), array[]::uuid[]);

  delete from public.credit_applications ca
  where ca.id = any(v_credit_app_ids)
     or ca.credit_id = any(v_credit_ids);

  delete from public.player_credits pc
  where pc.id = any(v_credit_ids);

  delete from public.treasury_audit_log al
  where coalesce(al.entity_id = any(v_activity_ids), false)
     or coalesce(al.entity_id = any(v_debt_ids), false)
     or coalesce(al.entity_id = any(v_payment_ids), false)
     or coalesce(al.entity_id = any(v_movement_ids), false)
     or lower(coalesce(al.payload::text,'') || ' ' || coalesce(al.before_data::text,'') || ' ' || coalesce(al.after_data::text,'')) like any(v_title_patterns);

  delete from public.treasury_movements m
  where m.id = any(v_movement_ids);

  delete from public.payment_allocations pa
  where pa.payment_id = any(v_payment_ids)
     or (pa.target_type = 'activity_debt' and pa.target_id = any(v_debt_ids));

  delete from public.payments p
  where p.id = any(v_payment_ids);

  delete from public.activity_debts d
  where d.id = any(v_debt_ids);

  delete from public.treasury_activities a
  where a.id = any(v_activity_ids);

  delete from public.fee_payments fp
  where fp.fee_id = any(v_legacy_fee_ids);

  delete from public.fees f
  where f.id = any(v_legacy_fee_ids);

  if to_regclass('backup.gm_fees_before_treasury_20260722') is not null
     and to_regclass('backup.gm_fee_payments_before_treasury_20260722') is not null then
    select coalesce(array_agg(f.id), array[]::uuid[])
      into v_backup_20260722_fee_ids
    from backup.gm_fees_before_treasury_20260722 f
    where lower(regexp_replace(trim(coalesce(f.title,'')), '\s+', ' ', 'g')) = any(v_titles);

    delete from backup.gm_fee_payments_before_treasury_20260722 fp
    where fp.fee_id = any(v_backup_20260722_fee_ids);

    delete from backup.gm_fees_before_treasury_20260722 f
    where f.id = any(v_backup_20260722_fee_ids);
  end if;

  if to_regclass('backup.gm_fees_before_treasury_20260721') is not null
     and to_regclass('backup.gm_fee_payments_before_treasury_20260721') is not null then
    select coalesce(array_agg(f.id), array[]::uuid[])
      into v_backup_20260721_fee_ids
    from backup.gm_fees_before_treasury_20260721 f
    where lower(regexp_replace(trim(coalesce(f.title,'')), '\s+', ' ', 'g')) = any(v_titles);

    delete from backup.gm_fee_payments_before_treasury_20260721 fp
    where fp.fee_id = any(v_backup_20260721_fee_ids);

    delete from backup.gm_fees_before_treasury_20260721 f
    where f.id = any(v_backup_20260721_fee_ids);
  end if;
end;
$$;

-- Validacion: ambas filas deben volver con rows = 0.
with target_titles(title) as (
  values
    ('cuota mayo 2. 0'),
    ('cuota mayo 2.0'),
    ('tercer tiempo 26-03'),
    ('fuente la reina 07-05 cumple jean'),
    ('fuente la reina 07 -05 cumple jean'),
    ('cuota abril 2026'),
    ('cuoata abril 2026')
)
select 'public.fees_remaining' as check_name, count(*)::integer as rows
from public.fees f
where lower(regexp_replace(trim(coalesce(f.title,'')), '\s+', ' ', 'g')) in (select title from target_titles)
union all
select 'public.treasury_activities_remaining' as check_name, count(*)::integer as rows
from public.treasury_activities a
where lower(regexp_replace(trim(coalesce(a.name,'')), '\s+', ' ', 'g')) in (select title from target_titles)
union all
select 'public.activity_debts_for_deleted_activities' as check_name, count(*)::integer as rows
from public.activity_debts d
join public.treasury_activities a on a.id = d.activity_id
where lower(regexp_replace(trim(coalesce(a.name,'')), '\s+', ' ', 'g')) in (select title from target_titles);

-- Validacion de seguridad: Liga invierno debe seguir existiendo.
select
  'liga_invierno_still_present' as check_name,
  count(*)::integer as activities,
  coalesce(sum(d.assigned_amount) filter (where d.status = 'pending'), 0)::integer as pending_amount,
  coalesce(sum(d.assigned_amount) filter (where d.status = 'paid'), 0)::integer as paid_amount
from public.treasury_activities a
left join public.activity_debts d on d.activity_id = a.id
where lower(regexp_replace(trim(coalesce(a.name,'')), '\s+', ' ', 'g')) = 'liga invierno colegio mayor';
