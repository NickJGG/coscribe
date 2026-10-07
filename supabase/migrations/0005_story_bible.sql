create type public.entry_type as enum ('character', 'place', 'item', 'lore');

-- Name, type, and description are plain columns so the Story Bible can be listed and searched.
-- ydoc holds the body's Yjs state, read and written only by apps/sync over a direct connection.
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  type public.entry_type not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 280),
  ydoc bytea,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index entries_story_idx on public.entries (story_id);

-- Writers and up, while the story isn't Finished.
create function public.can_write_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.story_role(p_story) is not null
    and exists (select 1 from public.stories where id = p_story and status = 'active');
$$;

alter table public.entries enable row level security;

create policy "entries of visible stories are readable"
  on public.entries for select
  to anon, authenticated
  using (public.can_view_story(story_id));

create policy "writers add entries"
  on public.entries for insert
  to authenticated
  with check (public.can_write_story(story_id) and created_by = (select auth.uid()));

create policy "writers update entries"
  on public.entries for update
  to authenticated
  using (public.can_write_story(story_id))
  with check (public.can_write_story(story_id));

-- Mirrors Chapters: anyone can add, only Co-hosts and up can delete.
create policy "co-hosts delete entries"
  on public.entries for delete
  to authenticated
  using (public.story_role(story_id) >= 'cohost' and public.can_write_story(story_id));

revoke all on public.entries from anon, authenticated;
grant select (id, story_id, type, name, description, created_by, created_at) on public.entries to anon, authenticated;
grant insert (story_id, type, name, description) on public.entries to authenticated;
grant update (type, name, description) on public.entries to authenticated;
grant delete on public.entries to authenticated;

revoke execute on function public.can_write_story(uuid) from public, anon;
