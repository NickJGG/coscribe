-- Snapshots of a Chapter's full Yjs state, taken by apps/sync. `state` is read only by apps/sync;
-- content_hash (of the ProseMirror JSON) lets it skip a Snapshot when nothing changed.
create table public.chapter_snapshots (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  taken_at timestamptz not null default now(),
  name text check (name is null or char_length(btrim(name)) between 1 and 80),
  state bytea not null,
  content_hash text not null
);

create index chapter_snapshots_chapter_idx on public.chapter_snapshots (chapter_id, taken_at desc);

create function public.chapter_story(p_chapter uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select story_id from public.chapters where id = p_chapter;
$$;

alter table public.chapter_snapshots enable row level security;

create policy "co-hosts read snapshots"
  on public.chapter_snapshots for select
  to authenticated
  using (public.story_role(public.chapter_story(chapter_id)) >= 'cohost');

create policy "hosts name snapshots"
  on public.chapter_snapshots for update
  to authenticated
  using (public.story_role(public.chapter_story(chapter_id)) = 'host')
  with check (public.story_role(public.chapter_story(chapter_id)) = 'host');

revoke all on public.chapter_snapshots from anon, authenticated;
grant select (id, chapter_id, taken_at, name) on public.chapter_snapshots to authenticated;
grant update (name) on public.chapter_snapshots to authenticated;

-- The web app calls this before asking apps/sync to Restore, which trusts it. Returns the story.
create function public.authorize_restore(p_snapshot uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  story uuid;
begin
  select c.story_id into story
  from public.chapter_snapshots s
  join public.chapters c on c.id = s.chapter_id
  where s.id = p_snapshot;

  if story is null or public.story_role(story) is null or public.story_role(story) < 'cohost' then
    raise exception 'not_allowed';
  end if;
  if (select status from public.stories where id = story) = 'finished' then
    raise exception 'story_finished';
  end if;
  return story;
end;
$$;

revoke execute on function public.chapter_story(uuid) from public, anon;
revoke execute on function public.authorize_restore(uuid) from public, anon;
