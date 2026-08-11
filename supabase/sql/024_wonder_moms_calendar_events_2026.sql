-- Wonder Mom's Cup Clausura 2026 - eventos calendario Golden Dream/Power
-- Ejecutar despues de 023. Idempotente: actualiza los eventos Wonder Moms J1-J7 de Dreams/Power sin tocar otros eventos.
-- Fixture tomado del calendario SofaScore confirmado: 7 jornadas de fase regular. La fecha final aun no esta publicada.

with event_rows(jornada, title, type, team, opponent, uniform, location, datetime) as (
  values
    (1, 'Wonder Moms J1 - Golden Dream vs The British Queens', 'Partido'::public.gm_event_type, 'Dreams', 'The British Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 8, 27, 20, 0, 0, 'America/Santiago')),
    (1, 'Wonder Moms J1 - SNM Queens vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'SNM Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 8, 27, 21, 0, 0, 'America/Santiago')),
    (2, 'Wonder Moms J2 - Golden Dream vs Pedro Pé', 'Partido'::public.gm_event_type, 'Dreams', 'Pedro Pé', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 3, 21, 0, 0, 'America/Santiago')),
    (2, 'Wonder Moms J2 - The British Queens vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'The British Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 3, 20, 0, 0, 'America/Santiago')),
    (3, 'Wonder Moms J3 - Golden Dream vs Golden Power', 'Partido'::public.gm_event_type, 'Dreams', 'Golden Power', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 10, 20, 0, 0, 'America/Santiago')),
    (3, 'Wonder Moms J3 - Golden Dream vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'Golden Dream', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 10, 20, 0, 0, 'America/Santiago')),
    (4, 'Wonder Moms J4 - Les Guerrieres vs Golden Dream', 'Partido'::public.gm_event_type, 'Dreams', 'Les Guerrieres', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 24, 21, 0, 0, 'America/Santiago')),
    (4, 'Wonder Moms J4 - Golden Power vs Osas de Ossó', 'Partido'::public.gm_event_type, 'Power', 'Osas de Ossó', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 24, 20, 0, 0, 'America/Santiago')),
    (5, 'Wonder Moms J5 - Osas de Ossó vs Golden Dream', 'Partido'::public.gm_event_type, 'Dreams', 'Osas de Ossó', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 1, 20, 0, 0, 'America/Santiago')),
    (5, 'Wonder Moms J5 - Las Juanas vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'Las Juanas', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 1, 21, 0, 0, 'America/Santiago')),
    (6, 'Wonder Moms J6 - Golden Dream vs SNM Queens', 'Partido'::public.gm_event_type, 'Dreams', 'SNM Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 8, 21, 0, 0, 'America/Santiago')),
    (6, 'Wonder Moms J6 - Golden Power vs Pedro Pé', 'Partido'::public.gm_event_type, 'Power', 'Pedro Pé', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 8, 20, 0, 0, 'America/Santiago')),
    (7, 'Wonder Moms J7 - Golden Dream vs Las Juanas', 'Partido'::public.gm_event_type, 'Dreams', 'Las Juanas', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 15, 20, 0, 0, 'America/Santiago')),
    (7, 'Wonder Moms J7 - Golden Power vs Les Guerrieres', 'Partido'::public.gm_event_type, 'Power', 'Les Guerrieres', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 15, 21, 0, 0, 'America/Santiago'))
), updated as (
  update public.events e
     set title = r.title,
         type = r.type,
         team = r.team,
         opponent = r.opponent,
         uniform = r.uniform,
         location = r.location,
         datetime = r.datetime
    from event_rows r
   where e.team = r.team
     and e.title ilike ('Wonder Moms J' || r.jornada::text || ' - %')
  returning e.id
)
insert into public.events(title, type, team, opponent, uniform, location, datetime)
select title, type, team, opponent, uniform, location, datetime
from event_rows r
where not exists (
  select 1
  from public.events e
  where e.team = r.team
    and e.title ilike ('Wonder Moms J' || r.jornada::text || ' - %')
);
