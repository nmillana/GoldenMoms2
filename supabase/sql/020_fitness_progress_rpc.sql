begin;

-- RPC segura para marcar/desmarcar progreso desde la app estatica.
-- Ejecutar despues de 018_fitness_challenge.sql.

create or replace function public.fitness_set_progress(
  p_fitness_video_id uuid,
  p_completed boolean default true
)
returns public.fitness_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid := public.fitness_current_player_id();
  v_progress public.fitness_progress%rowtype;
  v_allowed boolean := false;
  v_completed boolean := coalesce(p_completed, true);
begin
  if v_player_id is null then
    raise exception 'Sesion fitness invalida. Vuelve a ingresar.' using errcode = '42501';
  end if;

  select exists(
    select 1
    from public.fitness_videos fv
    join public.fitness_days fd on fd.id = fv.fitness_day_id
    join public.fitness_months fm on fm.id = fd.fitness_month_id
    where fv.id = p_fitness_video_id
      and fd.day_type = 'workout'
      and fv.activity_type in ('required','optional')
      and (fm.status = 'published' or public.fitness_can_manage())
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Este video no esta disponible para progreso.' using errcode = '42501';
  end if;

  insert into public.fitness_progress(player_id, fitness_video_id, completed, completed_at)
  values (v_player_id, p_fitness_video_id, v_completed, case when v_completed then now() else null end)
  on conflict(player_id, fitness_video_id) do update set
    completed = excluded.completed,
    completed_at = excluded.completed_at,
    updated_at = now()
  returning * into v_progress;

  return v_progress;
end;
$$;

grant execute on function public.fitness_set_progress(uuid, boolean) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
