-- Wonder Mom's Cup Clausura 2026 - eventos calendario Golden Dream/Power
-- Ejecutar despues de 023. Idempotente: no duplica eventos con mismo titulo, equipo y fecha/hora.
-- J1 usa los rivales/horas visibles en las capturas entregadas.
-- J2-J7 quedan con fecha confirmada y horario/rival por confirmar, porque las bases no publican el fixture completo.

with event_rows(title, type, team, opponent, uniform, location, datetime) as (
  values
    ('Wonder Moms J1 - Golden Dream vs The British Queens', 'Partido', 'Dreams', 'The British Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 8, 27, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J1 - SNM Queens vs Golden Power', 'Partido', 'Power', 'SNM Queens', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 8, 27, 21, 0, 0, 'America/Santiago')),
    ('Wonder Moms J2 - Golden Dream (horario por confirmar)', 'Partido', 'Dreams', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 3, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J2 - Golden Power (horario por confirmar)', 'Partido', 'Power', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 3, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J3 - Golden Dream (horario por confirmar)', 'Partido', 'Dreams', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 10, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J3 - Golden Power (horario por confirmar)', 'Partido', 'Power', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 10, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J4 - Golden Dream (horario por confirmar)', 'Partido', 'Dreams', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 24, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J4 - Golden Power (horario por confirmar)', 'Partido', 'Power', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 9, 24, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J5 - Golden Dream (horario por confirmar)', 'Partido', 'Dreams', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 1, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J5 - Golden Power (horario por confirmar)', 'Partido', 'Power', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 1, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J6 - Golden Dream (horario por confirmar)', 'Partido', 'Dreams', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 8, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J6 - Golden Power (horario por confirmar)', 'Partido', 'Power', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 8, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J7 - Golden Dream (horario por confirmar)', 'Partido', 'Dreams', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 15, 20, 0, 0, 'America/Santiago')),
    ('Wonder Moms J7 - Golden Power (horario por confirmar)', 'Partido', 'Power', 'Por confirmar', null::text, 'Zapping Sport Center - Club Palestino', make_timestamptz(2026, 10, 15, 20, 0, 0, 'America/Santiago'))
)
insert into public.events(title, type, team, opponent, uniform, location, datetime)
select title, type, team, opponent, uniform, location, datetime
from event_rows r
where not exists (
  select 1
  from public.events e
  where e.title = r.title
    and e.team = r.team
    and e.datetime = r.datetime
);
