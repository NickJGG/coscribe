-- Presence. Where Writers are is written only by apps/sync (bypassing RLS), which clears both tables on
-- startup. Being a Writer makes you visible; Viewers are only ever counted.

-- One row per Writer per open document, however many tabs. Realtime can't check RLS for a row that's
-- gone, so a DELETE goes to every subscriber with just the primary key: hence an opaque id.
create table public.story_presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  kind text not null check (kind in ('chapter', 'entry')),
  document_id uuid not null,
  connected_at timestamptz not null default now(),
  unique (user_id, document_id)
);

create index story_presence_story_idx on public.story_presence (story_id);

alter table public.story_presence enable row level security;

create policy "presence in visible stories is readable"
  on public.story_presence for select
  to anon, authenticated
  using (public.can_view_story(story_id));

revoke all on public.story_presence from anon, authenticated;
grant select on public.story_presence to anon, authenticated;

alter publication supabase_realtime add table public.story_presence;

-- Live counts for the front page. Viewers are counted per browser, Writers per person.
create table public.story_activity (
  story_id uuid primary key references public.stories (id) on delete cascade,
  writers integer not null default 0,
  viewers integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.story_activity enable row level security;

create policy "activity of visible stories is readable"
  on public.story_activity for select
  to anon, authenticated
  using (public.can_view_story(story_id));

revoke all on public.story_activity from anon, authenticated;
grant select on public.story_activity to anon, authenticated;

-- last_seen is set by heartbeat() while a tab is visible. Profiles are public, but last_seen is only
-- for friends_presence() to judge, so it gets no select grant.
alter table public.profiles
  add column last_seen timestamptz,
  add column show_online boolean not null default true;

revoke select on public.profiles from anon, authenticated;
grant select (id, username, author_color, created_at, theme, show_online) on public.profiles to anon, authenticated;

create function public.heartbeat()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_seen = now() where id = (select auth.uid());
$$;

-- Friends online now (heartbeat within 2 minutes, show_online on). Where they're writing is shown only
-- when the caller could read that Story anyway; otherwise they're just online.
create function public.friends_presence()
returns table (
  user_id uuid,
  username text,
  author_color text,
  story_id uuid,
  story_title text,
  chapter_id uuid,
  chapter_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.author_color, w.story_id, w.story_title, w.chapter_id, w.chapter_title
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  left join lateral (
    select sp.story_id, s.title as story_title, c.id as chapter_id, c.title as chapter_title
    from public.story_presence sp
    join public.stories s on s.id = sp.story_id
    left join public.chapters c on c.id = sp.document_id and sp.kind = 'chapter'
    where sp.user_id = p.id and public.can_view_story(sp.story_id)
    order by sp.connected_at desc
    limit 1
  ) w on true
  where f.status = 'accepted'
    and (select auth.uid()) in (f.requester_id, f.addressee_id)
    and p.show_online
    and p.last_seen > now() - interval '2 minutes'
  order by p.username;
$$;

revoke execute on function public.heartbeat() from public, anon;
revoke execute on function public.friends_presence() from public, anon;

-- Tells open pages a Story's Chapters, Entries, members or settings changed, so they re-render.
-- Triggers fire only on columns people see, never on the sync server's ydoc and stats saves. No foreign
-- key: a Story's cascade delete fires these triggers too, and a leftover row for a deleted Story is
-- harmless (nobody can read it).
create table public.story_changes (
  story_id uuid primary key,
  changed_at timestamptz not null default now()
);

alter table public.story_changes enable row level security;

create policy "changes to visible stories are readable"
  on public.story_changes for select
  to anon, authenticated
  using (public.can_view_story(story_id));

revoke all on public.story_changes from anon, authenticated;
grant select on public.story_changes to anon, authenticated;

alter publication supabase_realtime add table public.story_changes;

create function public.story_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Through jsonb because plpgsql rejects new.story_id on stories even in an untaken branch.
  changed uuid := coalesce(to_jsonb(new), to_jsonb(old))
    ->> case when tg_table_name = 'stories' then 'id' else 'story_id' end;
begin
  insert into public.story_changes (story_id)
  select changed where exists (select 1 from public.stories where id = changed)
  on conflict (story_id) do update set changed_at = now();
  return null;
end;
$$;

revoke execute on function public.story_changed() from public, anon, authenticated;

create trigger story_changed after update of title, visibility, status on public.stories
  for each row execute function public.story_changed();
create trigger story_changed after insert or delete or update of title, position, locked on public.chapters
  for each row execute function public.story_changed();
create trigger story_changed after insert or delete or update of type, name, description, aliases, link_mentions on public.entries
  for each row execute function public.story_changed();
create trigger story_changed after insert or delete or update of role, author_color on public.story_members
  for each row execute function public.story_changed();
