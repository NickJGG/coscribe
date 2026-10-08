-- Co-hosts can take Snapshots on demand and name any Snapshot, like they can Restore.
drop policy "hosts name snapshots" on public.chapter_snapshots;

create policy "co-hosts name snapshots"
  on public.chapter_snapshots for update
  to authenticated
  using (public.story_role(public.chapter_story(chapter_id)) >= 'cohost')
  with check (public.story_role(public.chapter_story(chapter_id)) >= 'cohost');

-- The web app calls this before asking apps/sync to take a Snapshot, which trusts it. Returns the story.
create function public.authorize_snapshot(p_chapter uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  story uuid;
begin
  story := public.chapter_story(p_chapter);

  if story is null or public.story_role(story) is null or public.story_role(story) < 'cohost' then
    raise exception 'not_allowed';
  end if;
  if (select status from public.stories where id = story) = 'finished' then
    raise exception 'story_finished';
  end if;
  return story;
end;
$$;

revoke execute on function public.authorize_snapshot(uuid) from public, anon;
