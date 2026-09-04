begin;

-- Wonder Mom's Cup Clausura 2026 - correccion por desfase de inicio.
-- Ejecutar despues de 023, 024, 025 y 026.
-- Actualiza fechas de fixture/eventos Golden Dream/Power y registra resultados informados del 03-09-2026.
-- Power se registra 1-0 sobre SNM Queens interpretando el mensaje "Power gano -0" como 1-0.

with date_shift(jornada, scheduled_date, date_label) as (
  values
    (1, '2026-09-03'::date, '3-sep'),
    (2, '2026-09-10'::date, '10-sep'),
    (3, '2026-09-17'::date, '17-sep'),
    (4, '2026-10-01'::date, '1-oct'),
    (5, '2026-10-08'::date, '8-oct'),
    (6, '2026-10-15'::date, '15-oct'),
    (7, '2026-10-22'::date, '22-oct')
), tournament_target as (
  select id
  from public.tournaments
  where name = 'Wonder Mom''s Cup Clausura 2026'
  order by created_at desc
  limit 1
)
update public.tournament_schedule ts
   set scheduled_date = ds.scheduled_date,
       date_label = ds.date_label
  from date_shift ds, tournament_target tt
 where ts.tournament_id = tt.id
   and ts.phase = 'regular'
   and ts.jornada = ds.jornada;

with event_rows(jornada, title, type, team, opponent, uniform, location, datetime) as (
  values
    (1, 'Wonder Moms J1 - Golden Dream vs The British Queens', 'Partido'::public.gm_event_type, 'Dreams', 'The British Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 3, 20, 0, 0, 'America/Santiago')),
    (1, 'Wonder Moms J1 - SNM Queens vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'SNM Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 3, 21, 0, 0, 'America/Santiago')),
    (2, 'Wonder Moms J2 - Golden Dream vs Pedro Pé', 'Partido'::public.gm_event_type, 'Dreams', 'Pedro Pé', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 10, 21, 0, 0, 'America/Santiago')),
    (2, 'Wonder Moms J2 - The British Queens vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'The British Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 10, 20, 0, 0, 'America/Santiago')),
    (3, 'Wonder Moms J3 - Golden Dream vs Golden Power', 'Partido'::public.gm_event_type, 'Dreams', 'Golden Power', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 17, 20, 0, 0, 'America/Santiago')),
    (3, 'Wonder Moms J3 - Golden Dream vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'Golden Dream', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 17, 20, 0, 0, 'America/Santiago')),
    (4, 'Wonder Moms J4 - Les Guerrieres vs Golden Dream', 'Partido'::public.gm_event_type, 'Dreams', 'Les Guerrieres', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 1, 21, 0, 0, 'America/Santiago')),
    (4, 'Wonder Moms J4 - Golden Power vs Osas de Ossó', 'Partido'::public.gm_event_type, 'Power', 'Osas de Ossó', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 1, 20, 0, 0, 'America/Santiago')),
    (5, 'Wonder Moms J5 - Osas de Ossó vs Golden Dream', 'Partido'::public.gm_event_type, 'Dreams', 'Osas de Ossó', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 8, 20, 0, 0, 'America/Santiago')),
    (5, 'Wonder Moms J5 - Las Juanas vs Golden Power', 'Partido'::public.gm_event_type, 'Power', 'Las Juanas', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 8, 21, 0, 0, 'America/Santiago')),
    (6, 'Wonder Moms J6 - Golden Dream vs SNM Queens', 'Partido'::public.gm_event_type, 'Dreams', 'SNM Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 15, 21, 0, 0, 'America/Santiago')),
    (6, 'Wonder Moms J6 - Golden Power vs Pedro Pé', 'Partido'::public.gm_event_type, 'Power', 'Pedro Pé', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 15, 20, 0, 0, 'America/Santiago')),
    (7, 'Wonder Moms J7 - Golden Dream vs Las Juanas', 'Partido'::public.gm_event_type, 'Dreams', 'Las Juanas', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 22, 20, 0, 0, 'America/Santiago')),
    (7, 'Wonder Moms J7 - Golden Power vs Les Guerrieres', 'Partido'::public.gm_event_type, 'Power', 'Les Guerrieres', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 22, 21, 0, 0, 'America/Santiago'))
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

with tournament_target as (
  select id
  from public.tournaments
  where name = 'Wonder Mom''s Cup Clausura 2026'
  order by created_at desc
  limit 1
), result_rows(home_team_label, away_team_label, home_goals, away_goals) as (
  values
    ('Golden Dream', 'The British Queens', 4, 1),
    ('SNM Queens', 'Golden Power', 0, 1)
)
update public.tournament_schedule ts
   set home_goals = r.home_goals,
       away_goals = r.away_goals,
       home_penalties = null,
       away_penalties = null,
       status = 'finalizado',
       is_wo = false,
       winner_team_id = case
         when r.home_goals > r.away_goals then ts.home_team_id
         when r.away_goals > r.home_goals then ts.away_team_id
         else null
       end,
       notes = 'Resultado informado por Golden Moms el 04-09-2026.'
  from tournament_target tt, result_rows r
 where ts.tournament_id = tt.id
   and ts.phase = 'regular'
   and ts.jornada = 1
   and ts.home_team_label = r.home_team_label
   and ts.away_team_label = r.away_team_label;

with result_rows(team, title_like, opponent, match_date, goals_for, goals_against, observation) as (
  values
    ('Dreams', 'Wonder Moms J1 - Golden Dream vs The British Queens', 'The British Queens', '2026-09-03'::date, 4, 1, 'Resultado informado por Golden Moms el 04-09-2026.'),
    ('Power', 'Wonder Moms J1 - SNM Queens vs Golden Power', 'SNM Queens', '2026-09-03'::date, 1, 0, 'Resultado informado por Golden Moms el 04-09-2026.')
), target_events as (
  select e.id as event_id, r.*
  from public.events e
  join result_rows r
    on e.team = r.team
   and e.title = r.title_like
), updated as (
  update public.matches m
     set team = te.team,
         opponent = te.opponent,
         date = te.match_date,
         goals_for = te.goals_for,
         goals_against = te.goals_against,
         goal_difference = te.goals_for - te.goals_against,
         observation = te.observation
    from target_events te
   where m.event_id = te.event_id
  returning m.event_id
)
insert into public.matches(event_id, team, opponent, date, goals_for, goals_against, goal_difference, observation)
select event_id, team, opponent, match_date, goals_for, goals_against, goals_for - goals_against, observation
from target_events te
where not exists (
  select 1 from updated u where u.event_id = te.event_id
)
and not exists (
  select 1 from public.matches m where m.event_id = te.event_id
);

commit;

select
  ts.jornada,
  ts.scheduled_date,
  ts.scheduled_time,
  ts.home_team_label,
  ts.away_team_label,
  ts.status,
  ts.home_goals,
  ts.away_goals
from public.tournament_schedule ts
join public.tournaments t on t.id = ts.tournament_id
where t.name = 'Wonder Mom''s Cup Clausura 2026'
  and ts.phase = 'regular'
  and ts.jornada <= 2
order by ts.jornada, ts.scheduled_time, ts.home_team_label;
