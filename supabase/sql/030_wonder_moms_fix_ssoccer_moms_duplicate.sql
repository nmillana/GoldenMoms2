begin;

-- Wonder Mom's Cup Clausura 2026 - consolida el equipo Ssoccer Moms.
-- Corrige el typo historico "Ssoccers Moms" y asegura el resultado J1 3-0 vs Mamajuana.
-- Ejecutar despues de 025/028/029 si reaparece el duplicado.

with selected_tournament as (
  select id
  from public.tournaments
  where name = 'Wonder Mom''s Cup Clausura 2026'
  order by created_at desc nulls last, id desc
  limit 1
), canonical as (
  select tt.id, tt.tournament_id
  from public.tournament_teams tt
  join selected_tournament st on st.id = tt.tournament_id
  where tt.name = 'Ssoccer Moms'
  limit 1
), inserted_canonical as (
  insert into public.tournament_teams(tournament_id, name, grupo)
  select st.id, 'Ssoccer Moms', 'B'
  from selected_tournament st
  where not exists (select 1 from canonical)
  returning id, tournament_id
), canonical_team as (
  select id, tournament_id from canonical
  union all
  select id, tournament_id from inserted_canonical
  limit 1
), typo_teams as (
  select tt.id, tt.name, tt.tournament_id, ct.id as canonical_id
  from public.tournament_teams tt
  join canonical_team ct on ct.tournament_id = tt.tournament_id
  where tt.id <> ct.id
    and tt.name in ('Ssoccers Moms', 'Ssoccer Moms ')
), relink_schedule as (
  update public.tournament_schedule ts
     set home_team_id = case when ts.home_team_id = typo.id then typo.canonical_id else ts.home_team_id end,
         away_team_id = case when ts.away_team_id = typo.id then typo.canonical_id else ts.away_team_id end,
         winner_team_id = case when ts.winner_team_id = typo.id then typo.canonical_id else ts.winner_team_id end,
         home_team_label = case when ts.home_team_label = typo.name then 'Ssoccer Moms' else ts.home_team_label end,
         away_team_label = case when ts.away_team_label = typo.name then 'Ssoccer Moms' else ts.away_team_label end
    from typo_teams typo
   where ts.tournament_id = typo.tournament_id
     and (
       ts.home_team_id = typo.id
       or ts.away_team_id = typo.id
       or ts.winner_team_id = typo.id
       or ts.home_team_label = typo.name
       or ts.away_team_label = typo.name
     )
  returning ts.id
), delete_typo_teams as (
  delete from public.tournament_teams tt
  using typo_teams typo
  where tt.id = typo.id
  returning tt.id
)
update public.tournament_schedule ts
   set home_team_id = ct.id,
       home_team_label = 'Ssoccer Moms',
       home_goals = 3,
       away_goals = 0,
       home_penalties = null,
       away_penalties = null,
       status = 'finalizado',
       is_wo = false,
       winner_team_id = ct.id,
       notes = 'Resultado informado por Golden Moms el 04-09-2026.'
  from canonical_team ct
 where ts.tournament_id = ct.tournament_id
   and ts.phase = 'regular'
   and ts.jornada = 1
   and ts.home_team_label = 'Ssoccer Moms'
   and ts.away_team_label = 'Mamajuana';

commit;

select
  tt.name,
  tt.grupo,
  count(*) over () as ssoccer_rows_after
from public.tournament_teams tt
join public.tournaments t on t.id = tt.tournament_id
where t.name = 'Wonder Mom''s Cup Clausura 2026'
  and tt.name ilike '%soccer%'
order by tt.name;

select
  ts.jornada,
  ts.home_team_label,
  ts.away_team_label,
  ts.status,
  ts.home_goals,
  ts.away_goals,
  ts.winner_team_id
from public.tournament_schedule ts
join public.tournaments t on t.id = ts.tournament_id
where t.name = 'Wonder Mom''s Cup Clausura 2026'
  and ts.phase = 'regular'
  and ts.jornada = 1
  and ts.home_team_label = 'Ssoccer Moms'
  and ts.away_team_label = 'Mamajuana';
