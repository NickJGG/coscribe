alter table public.stories add column finished_at timestamptz;

-- Host only. Finishing locks every Chapter and Entry (apps/sync checks status); reopening unlocks them.
create function public.set_story_finished(p_story uuid, p_finished boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is distinct from 'host' then
    raise exception 'not_allowed';
  end if;

  update public.stories
  set status = case when p_finished then 'finished' else 'active' end::public.story_status,
      finished_at = case when p_finished then now() end
  where id = p_story;
end;
$$;

revoke execute on function public.set_story_finished(uuid, boolean) from public, anon;
