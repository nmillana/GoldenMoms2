begin;

-- Wonder Mom's Cup Clausura 2026 - no programar partidos el 17-09-2026.
-- Ejecutar despues de 028 si ese correctivo ya fue aplicado.
-- Mantiene resultados y citaciones; solo mueve la jornada 3 al 24-09-2026.

with tournament_target as (
  select id
  from public.tournaments
  where name = 'Wonder Mom''s Cup Clausura 2026'
  order by created_at desc
  limit 1
)
update public.tournament_schedule ts
   set scheduled_date = '2026-09-24'::date,
       date_label = '24-sep'
  from tournament_target tt
 where ts.tournament_id = tt.id
   and ts.phase = 'regular'
   and ts.jornada = 3;

update public.events
   set datetime = make_timestamptz(2026, 9, 24, 20, 0, 0, 'America/Santiago')
 where team in ('Dreams', 'Power')
   and title ilike 'Wonder Moms J3 - %';

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
  and ts.jornada in (2, 3, 4)
order by ts.jornada, ts.scheduled_time, ts.home_team_label;
