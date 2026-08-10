-- Wonder Mom's Cup Clausura 2026
-- Ejecutar una sola vez en Supabase antes de usar la nueva pestaña de torneo.
-- La tabla separa calendario de resultados para no romper el modulo anterior.

create table if not exists public.tournament_schedule (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  jornada smallint not null,
  phase text not null default 'regular',
  competition text,
  scheduled_date date,
  scheduled_time time,
  date_label text,
  venue text,
  home_team_id uuid references public.tournament_teams(id) on delete set null,
  away_team_id uuid references public.tournament_teams(id) on delete set null,
  home_rank smallint,
  away_rank smallint,
  home_team_label text,
  away_team_label text,
  home_goals smallint,
  away_goals smallint,
  home_penalties smallint,
  away_penalties smallint,
  winner_team_id uuid references public.tournament_teams(id) on delete set null,
  status text not null default 'programado',
  is_wo boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_schedule_phase_chk check (phase in ('regular','final')),
  constraint tournament_schedule_status_chk check (status in ('programado','finalizado','wo')),
  constraint tournament_schedule_goals_chk check (
    (home_goals is null and away_goals is null) or (home_goals >= 0 and away_goals >= 0)
  ),
  constraint tournament_schedule_penalties_chk check (
    (home_penalties is null and away_penalties is null) or (home_penalties >= 0 and away_penalties >= 0)
  )
);

alter table public.tournament_schedule
  add column if not exists scheduled_time time;

alter table public.tournament_schedule
  add column if not exists venue text;

create index if not exists tournament_schedule_tournament_idx
  on public.tournament_schedule(tournament_id, jornada, phase);

create index if not exists tournament_schedule_team_idx
  on public.tournament_schedule(home_team_id, away_team_id);

create or replace function public.set_tournament_schedule_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tournament_schedule_updated_at on public.tournament_schedule;
create trigger tournament_schedule_updated_at
before update on public.tournament_schedule
for each row execute function public.set_tournament_schedule_updated_at();

-- Lectura publica para que las jugadoras puedan revisar tablas.
-- Escritura limitada a sesiones RPC autorizadas de la app (admin/capitana)
-- usando el mismo puente seguro creado para Tesoreria: x-gm-treasury-session.
alter table public.tournament_schedule enable row level security;
drop policy if exists tournament_schedule_read on public.tournament_schedule;
drop policy if exists tournament_schedule_write on public.tournament_schedule;
create policy tournament_schedule_read on public.tournament_schedule
  for select to anon, authenticated using (true);
create policy tournament_schedule_write on public.tournament_schedule
  for all to anon, authenticated
  using (public.treasury_current_role() in ('service_role','admin','capitana'))
  with check (public.treasury_current_role() in ('service_role','admin','capitana'));

grant select on public.tournament_schedule to anon, authenticated;
grant insert, update, delete on public.tournament_schedule to anon, authenticated;
