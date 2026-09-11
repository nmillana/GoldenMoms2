-- Wonder Mom's Cup Clausura 2026 - limpieza de definiciones proyectadas.
-- Deja una sola fila por cruce de Copa Oro/Plata y marca la fecha como proyectada.

begin;

with selected_tournament as (
  select id
  from public.tournaments
  where name = 'Wonder Mom''s Cup Clausura 2026'
  order by created_at desc nulls last, id desc
  limit 1
), ranked_finals as (
  select
    ts.id,
    row_number() over (
      partition by ts.tournament_id, ts.competition, ts.home_rank, ts.away_rank
      order by
        case when ts.status in ('finalizado', 'wo') then 0 else 1 end,
        ts.updated_at desc nulls last,
        ts.created_at desc nulls last,
        ts.id
    ) as keep_order
  from public.tournament_schedule ts
  join selected_tournament st on st.id = ts.tournament_id
  where ts.phase = 'final'
), deleted_duplicates as (
  delete from public.tournament_schedule ts
  using ranked_finals rf
  where ts.id = rf.id
    and rf.keep_order > 1
  returning ts.id
)
update public.tournament_schedule ts
set
  date_label = 'Definiciones proyectadas - fecha por confirmar',
  notes = 'Proyeccion automatica segun tabla actual. Confirmar fecha y cruces definitivos cuando la organizacion publique la fase final.'
from selected_tournament st
where ts.tournament_id = st.id
  and ts.phase = 'final';

commit;

select
  competition,
  home_rank,
  away_rank,
  home_team_label,
  away_team_label,
  status,
  date_label
from public.tournament_schedule ts
join public.tournaments t on t.id = ts.tournament_id
where t.name = 'Wonder Mom''s Cup Clausura 2026'
  and ts.phase = 'final'
order by competition, home_rank;
