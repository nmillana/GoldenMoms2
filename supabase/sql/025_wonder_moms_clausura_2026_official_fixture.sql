-- Wonder Mom's Cup Clausura 2026 - fixture oficial SofaScore
-- Ejecutar despues de 023. Idempotente: crea torneo/equipos y agrega solo partidos oficiales faltantes.
-- La fase final no se carga porque SofaScore aun no publica esa jornada.

insert into public.tournaments(name, finished)
select 'Wonder Mom''s Cup Clausura 2026', false
where not exists (
  select 1 from public.tournaments where name = 'Wonder Mom''s Cup Clausura 2026'
);

with selected_tournament as (
  select id
  from public.tournaments
  where name = 'Wonder Mom''s Cup Clausura 2026'
  order by created_at nulls last, id
  limit 1
), team_rows(grupo, name) as (
  values
    ('A', 'Golden Dream'),
    ('A', 'The British Queens'),
    ('A', 'Las Juanas'),
    ('A', 'Pedro Pé'),
    ('A', 'Osas de Ossó'),
    ('A', 'Les Guerrieres'),
    ('A', 'SNM Queens'),
    ('A', 'Golden Power'),
    ('B', 'Panteras'),
    ('B', 'Mamurris'),
    ('B', 'Pumahuinas'),
    ('B', 'Queenlastair'),
    ('B', 'Team Dragón'),
    ('B', 'New Reds'),
    ('B', 'Ssoccer Moms'),
    ('B', 'Mamajuana')
), normalized as (
  update public.tournament_teams tt
     set name = 'Ssoccer Moms'
    from selected_tournament st
   where tt.tournament_id = st.id
     and tt.name in ('Ssoccers Moms', 'Ssoccer Moms ')
  returning tt.id
)
insert into public.tournament_teams(tournament_id, name, grupo)
select st.id, tr.name, tr.grupo
from selected_tournament st
cross join team_rows tr
where not exists (
  select 1
  from public.tournament_teams tt
  where tt.tournament_id = st.id
    and tt.name = tr.name
);

with selected_tournament as (
  select id
  from public.tournaments
  where name = 'Wonder Mom''s Cup Clausura 2026'
  order by created_at nulls last, id
  limit 1
), fixture_rows(jornada, scheduled_date, scheduled_time, grupo, home_name, away_name) as (
  values
    (1, '2026-08-27'::date, '20:00'::time, 'A', 'Golden Dream', 'The British Queens'),
    (1, '2026-08-27'::date, '20:00'::time, 'A', 'Las Juanas', 'Pedro Pé'),
    (1, '2026-08-27'::date, '20:00'::time, 'B', 'Panteras', 'Mamurris'),
    (1, '2026-08-27'::date, '20:00'::time, 'B', 'Pumahuinas', 'Queenlastair'),
    (1, '2026-08-27'::date, '20:00'::time, 'B', 'Team Dragón', 'New Reds'),
    (1, '2026-08-27'::date, '21:00'::time, 'A', 'Osas de Ossó', 'Les Guerrieres'),
    (1, '2026-08-27'::date, '21:00'::time, 'A', 'SNM Queens', 'Golden Power'),
    (1, '2026-08-27'::date, '21:00'::time, 'B', 'Ssoccer Moms', 'Mamajuana'),
    (2, '2026-09-03'::date, '20:00'::time, 'A', 'Las Juanas', 'Les Guerrieres'),
    (2, '2026-09-03'::date, '20:00'::time, 'A', 'SNM Queens', 'Osas de Ossó'),
    (2, '2026-09-03'::date, '20:00'::time, 'A', 'The British Queens', 'Golden Power'),
    (2, '2026-09-03'::date, '20:00'::time, 'B', 'Pumahuinas', 'Ssoccer Moms'),
    (2, '2026-09-03'::date, '20:00'::time, 'B', 'Team Dragón', 'Mamajuana'),
    (2, '2026-09-03'::date, '21:00'::time, 'A', 'Golden Dream', 'Pedro Pé'),
    (2, '2026-09-03'::date, '21:00'::time, 'B', 'Mamurris', 'Queenlastair'),
    (2, '2026-09-03'::date, '21:00'::time, 'B', 'Panteras', 'New Reds'),
    (3, '2026-09-10'::date, '20:00'::time, 'A', 'Golden Dream', 'Golden Power'),
    (3, '2026-09-10'::date, '20:00'::time, 'A', 'Pedro Pé', 'Les Guerrieres'),
    (3, '2026-09-10'::date, '20:00'::time, 'B', 'Mamurris', 'Ssoccer Moms'),
    (3, '2026-09-10'::date, '20:00'::time, 'B', 'New Reds', 'Mamajuana'),
    (3, '2026-09-10'::date, '20:00'::time, 'B', 'Panteras', 'Queenlastair'),
    (3, '2026-09-10'::date, '21:00'::time, 'A', 'Las Juanas', 'SNM Queens'),
    (3, '2026-09-10'::date, '21:00'::time, 'A', 'The British Queens', 'Osas de Ossó'),
    (3, '2026-09-10'::date, '21:00'::time, 'B', 'Pumahuinas', 'Team Dragón'),
    (4, '2026-09-24'::date, '20:00'::time, 'A', 'Golden Power', 'Osas de Ossó'),
    (4, '2026-09-24'::date, '20:00'::time, 'A', 'Las Juanas', 'The British Queens'),
    (4, '2026-09-24'::date, '20:00'::time, 'A', 'SNM Queens', 'Pedro Pé'),
    (4, '2026-09-24'::date, '20:00'::time, 'B', 'Pumahuinas', 'New Reds'),
    (4, '2026-09-24'::date, '20:00'::time, 'B', 'Team Dragón', 'Mamurris'),
    (4, '2026-09-24'::date, '21:00'::time, 'A', 'Les Guerrieres', 'Golden Dream'),
    (4, '2026-09-24'::date, '21:00'::time, 'B', 'Mamajuana', 'Panteras'),
    (4, '2026-09-24'::date, '21:00'::time, 'B', 'Queenlastair', 'Ssoccer Moms'),
    (5, '2026-10-01'::date, '20:00'::time, 'A', 'Les Guerrieres', 'SNM Queens'),
    (5, '2026-10-01'::date, '20:00'::time, 'A', 'Osas de Ossó', 'Golden Dream'),
    (5, '2026-10-01'::date, '20:00'::time, 'B', 'Mamajuana', 'Pumahuinas'),
    (5, '2026-10-01'::date, '20:00'::time, 'B', 'Ssoccer Moms', 'Panteras'),
    (5, '2026-10-01'::date, '20:00'::time, 'B', 'Team Dragón', 'Queenlastair'),
    (5, '2026-10-01'::date, '21:00'::time, 'A', 'Las Juanas', 'Golden Power'),
    (5, '2026-10-01'::date, '21:00'::time, 'A', 'The British Queens', 'Pedro Pé'),
    (5, '2026-10-01'::date, '21:00'::time, 'B', 'New Reds', 'Mamurris'),
    (6, '2026-10-08'::date, '20:00'::time, 'A', 'Golden Power', 'Pedro Pé'),
    (6, '2026-10-08'::date, '20:00'::time, 'A', 'Les Guerrieres', 'The British Queens'),
    (6, '2026-10-08'::date, '20:00'::time, 'A', 'Osas de Ossó', 'Las Juanas'),
    (6, '2026-10-08'::date, '20:00'::time, 'B', 'Mamajuana', 'Mamurris'),
    (6, '2026-10-08'::date, '20:00'::time, 'B', 'New Reds', 'Queenlastair'),
    (6, '2026-10-08'::date, '21:00'::time, 'A', 'Golden Dream', 'SNM Queens'),
    (6, '2026-10-08'::date, '21:00'::time, 'B', 'Panteras', 'Pumahuinas'),
    (6, '2026-10-08'::date, '21:00'::time, 'B', 'Ssoccer Moms', 'Team Dragón'),
    (7, '2026-10-15'::date, '20:00'::time, 'A', 'Golden Dream', 'Las Juanas'),
    (7, '2026-10-15'::date, '20:00'::time, 'A', 'The British Queens', 'SNM Queens'),
    (7, '2026-10-15'::date, '20:00'::time, 'B', 'Mamurris', 'Pumahuinas'),
    (7, '2026-10-15'::date, '20:00'::time, 'B', 'New Reds', 'Ssoccer Moms'),
    (7, '2026-10-15'::date, '20:00'::time, 'B', 'Panteras', 'Team Dragón'),
    (7, '2026-10-15'::date, '21:00'::time, 'A', 'Golden Power', 'Les Guerrieres'),
    (7, '2026-10-15'::date, '21:00'::time, 'A', 'Pedro Pé', 'Osas de Ossó'),
    (7, '2026-10-15'::date, '22:00'::time, 'B', 'Queenlastair', 'Mamajuana')
), mapped as (
  select st.id as tournament_id,
         fr.jornada,
         fr.scheduled_date,
         fr.scheduled_time,
         fr.grupo,
         fr.home_name,
         fr.away_name,
         home_team.id as home_team_id,
         away_team.id as away_team_id
  from fixture_rows fr
  cross join selected_tournament st
  join public.tournament_teams home_team
    on home_team.tournament_id = st.id and home_team.name = fr.home_name
  join public.tournament_teams away_team
    on away_team.tournament_id = st.id and away_team.name = fr.away_name
)
insert into public.tournament_schedule(
  tournament_id, jornada, phase, competition, scheduled_date, scheduled_time,
  date_label, venue, home_team_id, away_team_id, home_team_label, away_team_label,
  status, is_wo, notes
)
select m.tournament_id,
       m.jornada,
       'regular',
       'Fase regular Grupo ' || m.grupo,
       m.scheduled_date,
       m.scheduled_time,
       null,
       'Zapping Sport Center - Club Palestino',
       m.home_team_id,
       m.away_team_id,
       m.home_name,
       m.away_name,
       'programado',
       false,
       'Fixture oficial SofaScore. Fecha de definiciones aun no publicada.'
from mapped m
where not exists (
  select 1
  from public.tournament_schedule ts
  where ts.tournament_id = m.tournament_id
    and ts.phase = 'regular'
    and ts.jornada = m.jornada
    and ts.home_team_label = m.home_name
    and ts.away_team_label = m.away_name
);

select
  (select count(*) from public.tournaments where name = 'Wonder Mom''s Cup Clausura 2026') as tournaments,
  (select count(*) from public.tournament_teams tt join public.tournaments t on t.id = tt.tournament_id where t.name = 'Wonder Mom''s Cup Clausura 2026') as teams,
  (select count(*) from public.tournament_schedule ts join public.tournaments t on t.id = ts.tournament_id where t.name = 'Wonder Mom''s Cup Clausura 2026' and ts.phase = 'regular') as regular_matches;
