begin;

-- Registra una devolucion real desde la caja del equipo hacia una persona.
-- No borra ni edita saldo directo: crea un movimiento financiero de salida.
create or replace function public.treasury_register_personal_reimbursement(
  p_activity_id uuid,
  p_amount integer,
  p_paid_at timestamptz default now(),
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.treasury_activities%rowtype;
  v_movement_id uuid;
  v_original integer := 0;
  v_reimbursed integer := 0;
  v_pending integer := 0;
  v_player_name text := 'jugadora';
begin
  perform public.treasury_assert_writer();

  select id into v_movement_id
  from public.treasury_movements
  where idempotency_key = p_idempotency_key
  limit 1;

  if v_movement_id is not null then
    return jsonb_build_object('movement_id', v_movement_id, 'idempotent', true);
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Monto invalido';
  end if;

  select * into v_activity
  from public.treasury_activities
  where id = p_activity_id
  for update;

  if v_activity.id is null then
    raise exception 'Registro por devolver no encontrado';
  end if;

  if v_activity.payer_player_id is null then
    raise exception 'El registro no tiene persona asociada';
  end if;

  v_original := greatest(coalesce(v_activity.total_cost, 0) - coalesce(v_activity.team_contribution, 0), 0);

  select coalesce(sum(amount), 0)::integer
    into v_reimbursed
  from public.treasury_movements
  where source_table = 'treasury_activities'
    and source_id = v_activity.id
    and movement_type = 'personal_reimbursement_payment'
    and direction = 'out'
    and status = 'posted';

  v_pending := greatest(v_original - v_reimbursed, 0);

  if v_pending <= 0 then
    raise exception 'No hay saldo pendiente para devolver';
  end if;

  if p_amount > v_pending then
    raise exception 'El monto supera el saldo pendiente (%)', v_pending;
  end if;

  select coalesce(apodo, nombre, 'jugadora')
    into v_player_name
  from public.players
  where id = v_activity.payer_player_id;

  v_movement_id := public.treasury_insert_movement(
    'personal_reimbursement_payment',
    'out',
    p_amount,
    'Devolucion a ' || coalesce(v_player_name, 'jugadora') || ': ' || coalesce(v_activity.name, 'Saldo por devolver'),
    'team_fund',
    'treasury_activities',
    v_activity.id,
    null,
    v_activity.payer_player_id,
    v_activity.payer_player_id,
    coalesce(p_paid_at, now()),
    p_idempotency_key
  );

  update public.treasury_activities
     set administrative_status = case when v_pending - p_amount <= 0 then 'closed' else 'open' end,
         updated_at = now()
   where id = v_activity.id;

  perform public.treasury_log(
    gen_random_uuid()::text,
    p_idempotency_key,
    'personal_reimbursement.paid',
    'treasury_activities',
    v_activity.id,
    jsonb_build_object(
      'amount', p_amount,
      'pending_before', v_pending,
      'pending_after', greatest(v_pending - p_amount, 0)
    ),
    null
  );

  return jsonb_build_object('movement_id', v_movement_id, 'pending_after', greatest(v_pending - p_amount, 0));
end;
$$;

-- Agrega solo una jugadora a una cuota mensual ya creada.
-- Evita usar la RPC de generacion masiva, que agrega a todas las activas del equipo.
create or replace function public.treasury_add_monthly_fee_player(
  p_year integer,
  p_month integer,
  p_team text default 'Golden Moms',
  p_player_id uuid default null,
  p_idempotency_key text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setting public.treasury_settings%rowtype;
  v_fee_id uuid;
  v_existing_id uuid;
begin
  perform public.treasury_assert_writer();

  if exists(select 1 from public.treasury_audit_log where idempotency_key = p_idempotency_key) then
    return jsonb_build_object('idempotent', true, 'inserted', 0);
  end if;

  if p_player_id is null then
    raise exception 'Selecciona una jugadora';
  end if;

  if p_month is null or p_month < 1 or p_month > 12 then
    raise exception 'Mes invalido';
  end if;

  select id into v_existing_id
  from public.monthly_fees
  where player_id = p_player_id
    and year = p_year
    and month = p_month
    and status in ('pending', 'paid')
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('id', v_existing_id, 'inserted', 0, 'already_exists', true);
  end if;

  select * into v_setting from public.treasury_active_setting(p_year);

  if v_setting.id is null then
    raise exception 'No existe configuracion activa para el ano %', p_year;
  end if;

  insert into public.monthly_fees(
    player_id,
    year,
    month,
    team,
    gross_amount,
    dt_amount,
    team_fund_amount,
    amount_due,
    due_date,
    generated_from_settings_id,
    generated_by_user_id,
    idempotency_key
  ) values (
    p_player_id,
    p_year,
    p_month,
    coalesce(nullif(p_team, ''), 'Golden Moms'),
    v_setting.monthly_fee_amount,
    v_setting.dt_amount,
    v_setting.team_fund_amount,
    v_setting.monthly_fee_amount,
    make_date(p_year, p_month, 10),
    v_setting.id,
    auth.uid(),
    p_idempotency_key || '-' || p_player_id::text
  )
  on conflict do nothing
  returning id into v_fee_id;

  if v_fee_id is null then
    select id into v_existing_id
    from public.monthly_fees
    where player_id = p_player_id
      and year = p_year
      and month = p_month
      and status in ('pending', 'paid')
    limit 1;
    return jsonb_build_object('id', v_existing_id, 'inserted', 0, 'already_exists', true);
  end if;

  perform public.treasury_log(
    gen_random_uuid()::text,
    p_idempotency_key,
    'monthly_fee.player_added',
    'monthly_fees',
    v_fee_id,
    jsonb_build_object('year', p_year, 'month', p_month, 'team', p_team, 'player_id', p_player_id),
    null
  );

  return jsonb_build_object('id', v_fee_id, 'inserted', 1, 'already_exists', false);
end;
$$;

grant execute on function public.treasury_register_personal_reimbursement(uuid, integer, timestamptz, text) to anon, authenticated, service_role;
grant execute on function public.treasury_add_monthly_fee_player(integer, integer, text, uuid, text) to anon, authenticated, service_role;

-- Corrige el intento accidental de asociar Marce como cobro dentro de su propio saldo por devolver.
-- El saldo queda vivo por payer_player_id y se paga con treasury_register_personal_reimbursement.
update public.activity_debts d
   set status = 'cancelled',
       no_charge_reason = coalesce(d.no_charge_reason, 'Registro accidental corregido: el saldo ya esta asociado por payer_player_id'),
       updated_at = now()
from public.treasury_activities a
where d.activity_id = a.id
  and a.idempotency_key = 'tesorera-closing-20260723-personal-advance-marce'
  and d.status = 'no_charge'
  and d.payment_id is null;

notify pgrst, 'reload schema';

commit;

select
  a.name,
  coalesce(p.apodo, p.nombre, 'Sin nombre') as persona,
  a.total_cost::integer as monto_original,
  coalesce(sum(m.amount) filter (
    where m.status = 'posted'
      and m.direction = 'out'
      and m.movement_type = 'personal_reimbursement_payment'
  ), 0)::integer as devuelto,
  (a.total_cost - coalesce(sum(m.amount) filter (
    where m.status = 'posted'
      and m.direction = 'out'
      and m.movement_type = 'personal_reimbursement_payment'
  ), 0))::integer as pendiente
from public.treasury_activities a
left join public.players p on p.id = a.payer_player_id
left join public.treasury_movements m on m.source_table = 'treasury_activities' and m.source_id = a.id
where a.idempotency_key in (
  'tesorera-closing-20260723-personal-advance-marce',
  'tesorera-closing-20260723-personal-advance-consu'
)
group by a.id, a.name, p.apodo, p.nombre, a.total_cost
order by a.name;
