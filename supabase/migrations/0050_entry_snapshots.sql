-- Snapshots of an Entry's body (its Yjs state), like chapter_snapshots: taken by apps/sync, `state` read
-- only by apps/sync, and read, named and Restored by Co-hosts and up. Name, description, type and aliases
-- aren't part of an Entry Snapshot.
create table public.entry_snapshots (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  taken_at timestamptz not null default now(),
  name text check (name is null or char_length(btrim(name)) between 1 and 80),
  state bytea not null,
  content_hash text not null
);

create index entry_snapshots_entry_idx on public.entry_snapshots (entry_id, taken_at desc);

create function public.entry_story(p_entry uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select story_id from public.entries where id = p_entry and deleted_at is null;
$$;

alter table public.entry_snapshots enable row level security;

create policy "co-hosts read entry snapshots"
  on public.entry_snapshots for select
  to authenticated
  using (public.story_role(public.entry_story(entry_id)) >= 'cohost');

create policy "co-hosts name entry snapshots"
  on public.entry_snapshots for update
  to authenticated
  using (public.story_role(public.entry_story(entry_id)) >= 'cohost')
  with check (public.story_role(public.entry_story(entry_id)) >= 'cohost');

revoke all on public.entry_snapshots from anon, authenticated;
grant select (id, entry_id, taken_at, name) on public.entry_snapshots to authenticated;
grant update (name) on public.entry_snapshots to authenticated;

-- The web app calls this before asking apps/sync to take a Snapshot, which trusts it. Returns the story.
create function public.authorize_entry_snapshot(p_entry uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  story uuid;
begin
  story := public.entry_story(p_entry);

  if story is null or public.story_role(story) is null or public.story_role(story) < 'cohost' then
    raise exception 'not_allowed';
  end if;
  if (select status from public.stories where id = story) = 'finished' then
    raise exception 'story_finished';
  end if;
  return story;
end;
$$;

-- The web app calls this before asking apps/sync to Restore, which trusts it. Returns the story.
create function public.authorize_entry_restore(p_snapshot uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  story uuid;
begin
  select e.story_id into story
  from public.entry_snapshots s
  join public.entries e on e.id = s.entry_id and e.deleted_at is null
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

revoke execute on function public.entry_story(uuid) from public, anon;
revoke execute on function public.authorize_entry_snapshot(uuid) from public, anon;
revoke execute on function public.authorize_entry_restore(uuid) from public, anon;
