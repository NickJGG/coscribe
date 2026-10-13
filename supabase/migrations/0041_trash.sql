-- The Trash. Deleting a Chapter or Entry moves it to its Story's Trash; deleting a Story moves it to its
-- Host's. Either is kept 30 days, then purged; only the Host purges sooner (Empty Trash), and only the Host
-- and Co-hosts restore (only the Host, for a Story).
--
-- Trashed rows are hidden at the choke points rather than in every query: story_role(), can_view_story()
-- and story_active() treat a trashed Story as gone, so every policy and RPC built on them goes dark with
-- it; chapter_story(), chapter_live() and entry_live() do the same for a trashed Chapter or Entry.
-- Security definer functions that read the tables directly filter for themselves.
--
-- A trashed Chapter or Entry has no position, so the live ones stay numbered 1..n; deleted_after names
-- the one it followed, so a restore puts it back beside it.

alter table public.stories
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null;

alter table public.chapters
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null,
  add column deleted_after uuid,
  alter column position drop not null;

alter table public.entries
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles (id) on delete set null,
  add column deleted_after uuid,
  alter column position drop not null;

create index stories_trash_idx on public.stories (deleted_at) where deleted_at is not null;
create index chapters_trash_idx on public.chapters (story_id, deleted_at) where deleted_at is not null;
create index entries_trash_idx on public.entries (story_id, deleted_at) where deleted_at is not null;

-- Choke points

create or replace function public.story_role(p_story uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.story_members m
  join public.stories s on s.id = m.story_id
  where m.story_id = p_story and m.user_id = (select auth.uid()) and s.deleted_at is null;
$$;

create or replace function public.can_view_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories
    where id = p_story
      and deleted_at is null
      and (visibility = 'public' or public.story_role(p_story) is not null)
  ) or exists (
    select 1 from public.invites i
    join public.stories s on s.id = i.story_id
    where i.story_id = p_story
      and i.invitee_id = (select auth.uid())
      and i.used_at is null
      and s.deleted_at is null
  );
$$;

create or replace function public.story_active(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories where id = p_story and status = 'active' and deleted_at is null
  );
$$;

create or replace function public.chapter_story(p_chapter uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select story_id from public.chapters where id = p_chapter and deleted_at is null;
$$;

create function public.chapter_live(p_chapter uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chapters c
    join public.stories s on s.id = c.story_id
    where c.id = p_chapter and c.deleted_at is null and s.deleted_at is null
  );
$$;

create function public.entry_live(p_entry uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    join public.stories s on s.id = e.story_id
    where e.id = p_entry and e.deleted_at is null and s.deleted_at is null
  );
$$;

-- Positions from the order of p_ids. The unique (story_id, position) is deferred, so any order is fine.
create function public.set_chapter_order(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.chapters c
  set position = o.ord
  from unnest(p_ids) with ordinality o(id, ord)
  where c.id = o.id and c.position is distinct from o.ord;
$$;

create function public.set_entry_order(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.entries e
  set position = o.ord
  from unnest(p_ids) with ordinality o(id, ord)
  where e.id = o.id and e.position is distinct from o.ord;
$$;

-- Policies

drop policy "chapters of visible stories are readable" on public.chapters;
create policy "live chapters of visible stories are readable"
  on public.chapters for select
  to anon, authenticated
  using (public.can_view_story(story_id) and deleted_at is null);

drop policy "co-hosts update chapters" on public.chapters;
create policy "co-hosts update chapters"
  on public.chapters for update
  to authenticated
  using (public.story_role(story_id) >= 'cohost' and public.story_active(story_id) and deleted_at is null)
  with check (public.story_role(story_id) >= 'cohost' and public.story_active(story_id) and deleted_at is null);

drop policy "entries of visible stories are readable" on public.entries;
create policy "live entries of visible stories are readable"
  on public.entries for select
  to anon, authenticated
  using (public.can_view_story(story_id) and deleted_at is null);

drop policy "writers update entries" on public.entries;
create policy "writers update entries"
  on public.entries for update
  to authenticated
  using (public.can_write_story(story_id) and deleted_at is null)
  with check (public.can_write_story(story_id) and deleted_at is null);

drop policy "writers read notes" on public.notes;
create policy "writers read notes"
  on public.notes for select
  to authenticated
  using (public.is_writer(story_id) and public.chapter_live(chapter_id));

drop policy "writers read note replies" on public.note_replies;
create policy "writers read note replies"
  on public.note_replies for select
  to authenticated
  using (public.is_writer(story_id) and public.chapter_live(chapter_id));

drop policy "writers read chapter outlines" on public.chapter_outlines;
create policy "writers read chapter outlines"
  on public.chapter_outlines for select
  to authenticated
  using (public.is_writer(story_id) and public.chapter_live(chapter_id));

drop policy "featured passages of finished readable stories are readable" on public.featured_passages;
create policy "featured passages of finished readable stories are readable"
  on public.featured_passages for select
  to anon, authenticated
  using (
    public.chapter_live(chapter_id)
    and (
      user_id = (select auth.uid())
      or (
        public.can_view_story(story_id)
        and exists (select 1 from public.stories s where s.id = story_id and s.status = 'finished')
      )
    )
  );

drop policy "members read their own pins" on public.pinned_entries;
create policy "members read their own pins"
  on public.pinned_entries for select
  to authenticated
  using (user_id = (select auth.uid()) and public.entry_live(entry_id));

drop policy "members pin entries of their stories" on public.pinned_entries;
create policy "members pin entries of their stories"
  on public.pinned_entries for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.story_role(story_id) is not null
    and public.entry_live(entry_id)
    and exists (select 1 from public.entries e where e.id = entry_id and e.story_id = pinned_entries.story_id)
  );

-- Moving to the Trash. Whoever's work it holds hears about it: the Writers with text in a Chapter, or an
-- Entry's creator. notify() leaves out whoever did it.

-- Keeps its name so deployed code still calls it.
create or replace function public.delete_chapter(p_chapter uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.chapters;
  before_id uuid;
begin
  select * into ch from public.chapters where id = p_chapter and deleted_at is null;
  if not found or public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.stories where id = ch.story_id for update;
  if not public.story_active(ch.story_id) then
    raise exception 'story_finished';
  end if;
  if (select count(*) from public.chapters where story_id = ch.story_id and deleted_at is null) = 1 then
    raise exception 'last_chapter';
  end if;

  select id into before_id from public.chapters
  where story_id = ch.story_id and deleted_at is null and position < ch.position
  order by position desc
  limit 1;

  update public.chapters
  set deleted_at = now(), deleted_by = (select auth.uid()), deleted_after = before_id, position = null
  where id = p_chapter;
  perform public.set_chapter_order(array(
    select id from public.chapters where story_id = ch.story_id and deleted_at is null order by position
  ));

  perform public.notify(
    array(
      select w from unnest(public.story_writer_ids(ch.story_id)) w
      where coalesce((ch.author_chars ->> w::text)::numeric, 0) > 0
    ),
    'moved_to_trash',
    ch.story_id,
    jsonb_build_object('item_kind', 'chapter', 'item_id', ch.id, 'title', ch.title)
  );
end;
$$;

create function public.trash_entry(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  en public.entries;
  before_id uuid;
begin
  select * into en from public.entries where id = p_entry and deleted_at is null;
  if not found or public.story_role(en.story_id) is null or public.story_role(en.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.stories where id = en.story_id for update;
  if not public.story_active(en.story_id) then
    raise exception 'story_finished';
  end if;

  select id into before_id from public.entries
  where story_id = en.story_id and type = en.type and deleted_at is null and position < en.position
  order by position desc
  limit 1;

  update public.entries
  set deleted_at = now(), deleted_by = (select auth.uid()), deleted_after = before_id, position = null
  where id = p_entry;
  perform public.set_entry_order(array(
    select id from public.entries
    where story_id = en.story_id and type = en.type and deleted_at is null
    order by position
  ));

  perform public.notify(
    array(select en.created_by where en.created_by = any (public.story_writer_ids(en.story_id))),
    'moved_to_trash',
    en.story_id,
    jsonb_build_object('item_kind', 'entry', 'item_id', en.id, 'title', en.name)
  );
end;
$$;

-- Host only. Members hear about it first. Keeps its name so deployed code still calls it.
create or replace function public.delete_story(p_story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is distinct from 'host' then
    raise exception 'not_allowed';
  end if;

  perform public.notify(public.story_member_ids(p_story), 'story_deleted', p_story);
  update public.stories set deleted_at = now(), deleted_by = (select auth.uid()) where id = p_story;
end;
$$;

-- Restoring. A Chapter or Entry goes back just after the one it followed, or first if that one's gone.
-- p_undo is the deleter taking it back straight away: the moved_to_trash notifications are withdrawn
-- instead of a restored one following them.

create function public.restore_chapter(p_chapter uuid, p_undo boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.chapters;
  ids uuid[];
  k integer;
begin
  select * into ch from public.chapters
  where id = p_chapter and deleted_at > now() - interval '30 days';
  if not found then
    raise exception 'not_in_trash';
  end if;
  if public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost'
    or (p_undo and ch.deleted_by is distinct from (select auth.uid())) then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.stories where id = ch.story_id for update;
  if not public.story_active(ch.story_id) then
    raise exception 'story_finished';
  end if;

  ids := array(
    select id from public.chapters where story_id = ch.story_id and deleted_at is null order by position
  );
  k := coalesce(array_position(ids, ch.deleted_after), 0);
  update public.chapters set deleted_at = null, deleted_by = null, deleted_after = null where id = ch.id;
  perform public.set_chapter_order(ids[1:k] || ch.id || ids[k + 1:]);

  if p_undo then
    delete from public.notifications
    where story_id = ch.story_id and kind = 'moved_to_trash' and detail ->> 'item_id' = ch.id::text;
  else
    perform public.notify(
      array(
        select w from unnest(public.story_writer_ids(ch.story_id)) w
        where coalesce((ch.author_chars ->> w::text)::numeric, 0) > 0
      ),
      'restored',
      ch.story_id,
      jsonb_build_object('item_kind', 'chapter', 'item_id', ch.id, 'title', ch.title)
    );
  end if;
end;
$$;

create function public.restore_entry(p_entry uuid, p_undo boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  en public.entries;
  ids uuid[];
  k integer;
begin
  select * into en from public.entries
  where id = p_entry and deleted_at > now() - interval '30 days';
  if not found then
    raise exception 'not_in_trash';
  end if;
  if public.story_role(en.story_id) is null or public.story_role(en.story_id) < 'cohost'
    or (p_undo and en.deleted_by is distinct from (select auth.uid())) then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.stories where id = en.story_id for update;
  if not public.story_active(en.story_id) then
    raise exception 'story_finished';
  end if;

  ids := array(
    select id from public.entries
    where story_id = en.story_id and type = en.type and deleted_at is null
    order by position
  );
  k := coalesce(array_position(ids, en.deleted_after), 0);
  update public.entries set deleted_at = null, deleted_by = null, deleted_after = null where id = en.id;
  perform public.set_entry_order(ids[1:k] || en.id || ids[k + 1:]);

  if p_undo then
    delete from public.notifications
    where story_id = en.story_id and kind = 'moved_to_trash' and detail ->> 'item_id' = en.id::text;
  else
    perform public.notify(
      array(select en.created_by where en.created_by = any (public.story_writer_ids(en.story_id))),
      'restored',
      en.story_id,
      jsonb_build_object('item_kind', 'entry', 'item_id', en.id, 'title', en.name)
    );
  end if;
end;
$$;

-- story_role() is null while the Story is trashed, so the Host is read from story_members. Undo comes
-- here too; the story_deleted notifications stay, and story_restored follows them.
create function public.restore_story(p_story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.story_members
    where story_id = p_story and user_id = (select auth.uid()) and role = 'host'
  ) then
    raise exception 'not_allowed';
  end if;

  update public.stories set deleted_at = null, deleted_by = null
  where id = p_story and deleted_at > now() - interval '30 days';
  if not found then
    raise exception 'not_in_trash';
  end if;
  perform public.notify(public.story_member_ids(p_story), 'story_restored', p_story);
end;
$$;

-- Lists

-- Any Writer sees what's in their Story's Trash and who put it there; Viewers see nothing.
create function public.story_trash(p_story uuid)
returns table (
  kind text,
  id uuid,
  title text,
  entry_type public.entry_type,
  deleted_by uuid,
  deleted_by_username text,
  deleted_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.kind, t.id, t.title, t.entry_type, t.deleted_by, p.username, t.deleted_at,
    t.deleted_at + interval '30 days'
  from (
    select 'chapter' as kind, c.id, c.title, null::public.entry_type as entry_type, c.deleted_by, c.deleted_at
    from public.chapters c
    where c.story_id = p_story and c.deleted_at > now() - interval '30 days'
    union all
    select 'entry', e.id, e.name, e.type, e.deleted_by, e.deleted_at
    from public.entries e
    where e.story_id = p_story and e.deleted_at > now() - interval '30 days'
  ) t
  left join public.profiles p on p.id = t.deleted_by
  where public.is_writer(p_story)
  order by t.deleted_at desc;
$$;

create function public.my_story_trash()
returns table (id uuid, title text, deleted_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.deleted_at, s.deleted_at + interval '30 days'
  from public.stories s
  join public.story_members m on m.story_id = s.id
  where m.user_id = (select auth.uid())
    and m.role = 'host'
    and s.deleted_at > now() - interval '30 days'
  order by s.deleted_at desc;
$$;

-- Purging. Empty Trash is the Host's alone, and still works on a Finished Story.

create function public.empty_trash(p_story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is distinct from 'host' then
    raise exception 'not_allowed';
  end if;

  delete from public.chapters where story_id = p_story and deleted_at is not null;
  delete from public.entries where story_id = p_story and deleted_at is not null;
end;
$$;

create function public.empty_story_trash()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.stories s
  where s.deleted_at is not null
    and exists (
      select 1 from public.story_members m
      where m.story_id = s.id and m.user_id = (select auth.uid()) and m.role = 'host'
    );
$$;

create function public.purge_expired_trash()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.stories where deleted_at <= now() - interval '30 days';
  delete from public.chapters where deleted_at <= now() - interval '30 days';
  delete from public.entries where deleted_at <= now() - interval '30 days';
$$;

create extension if not exists pg_cron;
select cron.schedule('purge-trash', '17 4 * * *', 'select public.purge_expired_trash()');

-- Security definer functions that read Stories, Chapters or Entries directly. Bodies match their latest
-- versions apart from the live filters.

create or replace function public.move_chapter_to(p_chapter uuid, p_after uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.chapters;
  ids uuid[];
  k integer;
begin
  select * into ch from public.chapters where id = p_chapter and deleted_at is null;
  if not found or public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  if (select status from public.stories where id = ch.story_id for update) = 'finished' then
    raise exception 'story_finished';
  end if;
  if p_after = p_chapter then
    return;
  end if;
  if p_after is not null and not exists (
    select 1 from public.chapters where id = p_after and story_id = ch.story_id and deleted_at is null
  ) then
    raise exception 'chapter_list_changed';
  end if;

  ids := array(
    select id from public.chapters
    where story_id = ch.story_id and id <> p_chapter and deleted_at is null
    order by position
  );
  k := coalesce(array_position(ids, p_after), 0);
  perform public.set_chapter_order(ids[1:k] || p_chapter || ids[k + 1:]);
end;
$$;

create or replace function public.move_entry_to(p_entry uuid, p_after uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  en public.entries;
  ids uuid[];
  k integer;
begin
  select * into en from public.entries where id = p_entry and deleted_at is null;
  if not found or public.story_role(en.story_id) is null or public.story_role(en.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  if (select status from public.stories where id = en.story_id for update) = 'finished' then
    raise exception 'story_finished';
  end if;
  if p_after = p_entry then
    return;
  end if;
  if p_after is not null and not exists (
    select 1 from public.entries
    where id = p_after and story_id = en.story_id and type = en.type and deleted_at is null
  ) then
    raise exception 'entry_list_changed';
  end if;

  ids := array(
    select id from public.entries
    where story_id = en.story_id and type = en.type and id <> p_entry and deleted_at is null
    order by position
  );
  k := coalesce(array_position(ids, p_after), 0);
  perform public.set_entry_order(ids[1:k] || p_entry || ids[k + 1:]);
end;
$$;

create or replace function public.add_note(p_id uuid, p_chapter uuid, p_quote text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch record;
begin
  select story_id, locked, title into ch from public.chapters where id = p_chapter and deleted_at is null;
  if not found or not public.is_writer(ch.story_id) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(ch.story_id) then
    raise exception 'story_finished';
  end if;
  if ch.locked then
    raise exception 'chapter_locked';
  end if;

  insert into public.notes (id, story_id, chapter_id, author_id, quote, body)
  values (p_id, ch.story_id, p_chapter, (select auth.uid()), left(btrim(p_quote), 300), btrim(p_body));

  perform public.notify(
    public.writer_mention_ids(p_body, ch.story_id),
    'note_mention',
    ch.story_id,
    jsonb_build_object(
      'chapter_id', p_chapter,
      'chapter_title', ch.title,
      'excerpt', left(public.writer_mention_text(btrim(p_body)), 140)
    ),
    null,
    p_id
  );
end;
$$;

create or replace function public.authorize_restore(p_snapshot uuid)
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
  join public.chapters c on c.id = s.chapter_id and c.deleted_at is null
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

-- story_role() is null in a trashed Story, which would otherwise let its Host leave it.
create or replace function public.leave_story(p_story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is null then
    raise exception 'not_allowed';
  end if;
  if public.story_role(p_story) = 'host' then
    raise exception 'host_cannot_leave';
  end if;
  delete from public.story_members where story_id = p_story and user_id = (select auth.uid());
  perform public.forget_story_notifications(p_story, (select auth.uid()));
end;
$$;

create or replace function public.accept_invite(p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  select i.* into inv from public.invites i
  join public.stories s on s.id = i.story_id and s.deleted_at is null
  where i.id = p_invite and i.invitee_id = (select auth.uid()) and i.used_at is null
  for update of i;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if inv.role = 'writer' and not public.story_active(inv.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.story_members (story_id, user_id, role) values (inv.story_id, inv.invitee_id, inv.role)
  on conflict do nothing;
  if found and inv.role = 'writer' then
    perform public.assign_story_color(inv.story_id, inv.invitee_id);
    perform public.notify(public.story_writer_ids(inv.story_id), 'writer_joined', inv.story_id);
  end if;
  update public.invites set used_at = now(), used_by = inv.invitee_id where id = inv.id;
  delete from public.notifications where invite_id = inv.id;
  return inv.story_id;
end;
$$;

create or replace function public.accept_invite_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_signed_in';
  end if;

  select i.* into inv from public.invites i
  join public.stories s on s.id = i.story_id and s.deleted_at is null
  where i.token = p_token
  for update of i;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if inv.used_at is not null then
    raise exception 'invite_used';
  end if;
  if exists (select 1 from public.story_members where story_id = inv.story_id and user_id = me) then
    raise exception 'already_member';
  end if;
  if inv.role = 'writer' and not public.story_active(inv.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.story_members (story_id, user_id, role) values (inv.story_id, me, inv.role);
  update public.invites set used_at = now(), used_by = me where id = inv.id;
  if inv.role = 'writer' then
    perform public.assign_story_color(inv.story_id, me);
    perform public.notify(public.story_writer_ids(inv.story_id), 'writer_joined', inv.story_id);
  end if;
  -- A Friend Invite to the same Story has nothing left to join.
  delete from public.notifications n
  using public.invites i
  where n.invite_id = i.id and i.story_id = inv.story_id and i.invitee_id = me;
  return inv.story_id;
end;
$$;

create or replace function public.invite_link_preview(p_token text)
returns table (story_id uuid, story_title text, inviter_username text, used boolean, role public.member_role)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, p.username, i.used_at is not null, i.role
  from public.invites i
  join public.stories s on s.id = i.story_id and s.deleted_at is null
  join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

create or replace function public.live_public_stories()
returns table (id uuid, title text, blurb text, writers integer, viewers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.blurb, a.writers, a.viewers
  from public.stories s
  join public.story_activity a on a.story_id = s.id
  where s.visibility = 'public'
    and s.deleted_at is null
    and not s.hidden_from_front
    and a.writers > 0
    and (
      select coalesce(sum(c.word_count), 0) from public.chapters c
      where c.story_id = s.id and c.deleted_at is null
    ) >= 200
  order by a.writers desc, a.viewers desc, s.created_at desc
  limit 3;
$$;

create or replace function public.public_stories()
returns table (
  id uuid,
  title text,
  blurb text,
  status public.story_status,
  writers integer,
  viewers integer,
  edited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.blurb, s.status, coalesce(a.writers, 0), coalesce(a.viewers, 0), e.edited_at
  from public.stories s
  left join public.story_activity a on a.story_id = s.id
  left join lateral (
    select max(c.edited_at) as edited_at from public.chapters c
    where c.story_id = s.id and c.deleted_at is null
  ) e on true
  where s.visibility = 'public' and s.deleted_at is null and not s.hidden_from_front
  order by coalesce(a.writers, 0) > 0 desc, e.edited_at desc nulls last, s.created_at desc
  limit 50;
$$;

create or replace function public.finished_public_stories()
returns table (id uuid, title text, blurb text, writers integer, chapters integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.title,
    s.blurb,
    (select count(*)::integer from public.story_members m where m.story_id = s.id and m.role >= 'writer'),
    (select count(*)::integer from public.chapters c where c.story_id = s.id and c.deleted_at is null)
  from public.stories s
  where s.visibility = 'public'
    and s.deleted_at is null
    and not s.hidden_from_front
    and s.status = 'finished'
  order by s.finished_at desc nulls last
  limit 3;
$$;

create or replace function public.friends_presence()
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
    left join public.chapters c on c.id = sp.document_id and sp.kind = 'chapter' and c.deleted_at is null
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

create or replace function public.writing_now(p_user uuid)
returns table (
  story_id uuid,
  story_title text,
  chapter_id uuid,
  chapter_title text,
  chapter_number integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, c.id, c.title,
    (select count(*)::integer from public.chapters o where o.story_id = c.story_id and o.position <= c.position)
  from public.story_presence sp
  join public.profiles p on p.id = sp.user_id
  join public.stories s on s.id = sp.story_id
  join public.chapters c on c.id = sp.document_id and c.deleted_at is null
  where sp.user_id = p_user
    and sp.kind = 'chapter'
    and public.can_view_story(sp.story_id)
    and p.show_online
    and p.last_seen > now() - interval '2 minutes'
  order by sp.connected_at desc
  limit 1;
$$;

-- Other tabs re-render their sidebars when something goes to or comes back from the Trash.
create trigger story_changed_deleted_at after update of deleted_at on public.chapters
  for each row execute function public.story_changed();
create trigger story_changed_deleted_at after update of deleted_at on public.entries
  for each row execute function public.story_changed();
create trigger story_changed_deleted_at after update of deleted_at on public.stories
  for each row execute function public.story_changed();

-- Anon keeps chapter_live(): the featured_passages policy runs it for visitors.
revoke execute on function public.chapter_live(uuid) from public;
grant execute on function public.chapter_live(uuid) to anon, authenticated;
revoke execute on function public.entry_live(uuid) from public, anon;
revoke execute on function public.set_chapter_order(uuid[]) from public, anon, authenticated;
revoke execute on function public.set_entry_order(uuid[]) from public, anon, authenticated;
revoke execute on function public.trash_entry(uuid) from public, anon;
revoke execute on function public.restore_chapter(uuid, boolean) from public, anon;
revoke execute on function public.restore_entry(uuid, boolean) from public, anon;
revoke execute on function public.restore_story(uuid) from public, anon;
revoke execute on function public.story_trash(uuid) from public, anon;
revoke execute on function public.my_story_trash() from public, anon;
revoke execute on function public.empty_trash(uuid) from public, anon;
revoke execute on function public.empty_story_trash() from public, anon;
revoke execute on function public.purge_expired_trash() from public, anon, authenticated;
