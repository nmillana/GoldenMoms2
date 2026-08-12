-- Wonder Moms Clausura 2026 - citaciones pendientes en calendario
-- Ejecutar despues de 024. Idempotente: crea asistencia Duda para los eventos Wonder Moms J1-J7
-- sin cambiar respuestas existentes Asiste / No asiste / Duda.

with target_events as (
  select e.id, e.title, e.team, e.datetime
  from public.events e
  where e.title ilike 'Wonder Moms J% - %'
    and e.team in ('Dreams', 'Power')
), eligible_players as (
  select e.id as event_id, p.id as player_id
  from target_events e
  join public.players p
    on lower(coalesce(p.estado::text, '')) = 'activo'
   and coalesce(p.equipos::text, '') ilike '%' || e.team || '%'
), missing_attendance as (
  select ep.event_id, ep.player_id
  from eligible_players ep
  where not exists (
    select 1
    from public.attendance a
    where a.event_id = ep.event_id
      and a.player_id = ep.player_id
  )
), inserted as (
  insert into public.attendance(event_id, player_id, status, updated_at)
  select event_id, player_id, 'Duda', now()
  from missing_attendance
  returning event_id, player_id
)
select
  'wonder_moms_attendance_pending_ready' as check_name,
  (select count(*) from target_events)::integer as events_found,
  (select count(*) from eligible_players)::integer as expected_citations,
  (select count(*) from inserted)::integer as inserted_citations,
  (select count(*) from public.attendance a join target_events e on e.id = a.event_id)::integer as total_citations_after;
