-- Notes: threads pinned to a passage of a Chapter, visible to Writers and up only, never to Viewers.
-- The passage is a `note` mark carrying the Note's id in the Chapter's Yjs doc; everything else lives
-- here. A missing mark never means a deleted Note (a Restore or an undo can bring it back), so nothing
-- here tracks it. Created, replied to, and resolved through the RPCs below; authors edit their own
-- messages directly, and deleting goes through RLS.

-- id comes from the client, so it can apply the mark as soon as the insert succeeds.
-- quote is the passage when the Note was made, kept for when the passage is gone.
create table public.notes (
  id uuid primary key,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  quote text not null check (char_length(quote) between 1 and 300),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  edited_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notes_chapter_idx on public.notes (chapter_id, created_at);
create index notes_story_idx on public.notes (story_id) where resolved_at is null;

-- story_id and chapter_id are copied from the Note, for RLS and the Realtime filter.
create table public.note_replies (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index note_replies_note_idx on public.note_replies (note_id, created_at);
create index note_replies_chapter_idx on public.note_replies (chapter_id);

create function public.set_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.edited_at := now();
  return new;
end;
$$;

create trigger set_edited_at before update of body on public.notes
  for each row when (old.body is distinct from new.body) execute function public.set_edited_at();
create trigger set_edited_at before update of body on public.note_replies
  for each row when (old.body is distinct from new.body) execute function public.set_edited_at();

alter table public.notes enable row level security;
alter table public.note_replies enable row level security;

create policy "members read notes"
  on public.notes for select
  to authenticated
  using (public.story_role(story_id) is not null);

create policy "authors edit their notes"
  on public.notes for update
  to authenticated
  using (author_id = (select auth.uid()) and public.can_write_story(story_id))
  with check (author_id = (select auth.uid()) and public.can_write_story(story_id));

-- Takes its replies with it; the client removes the mark.
create policy "authors and co-hosts delete notes"
  on public.notes for delete
  to authenticated
  using (
    (author_id = (select auth.uid()) or public.story_role(story_id) >= 'cohost')
    and public.can_write_story(story_id)
  );

create policy "members read note replies"
  on public.note_replies for select
  to authenticated
  using (public.story_role(story_id) is not null);

create policy "authors edit their note replies"
  on public.note_replies for update
  to authenticated
  using (author_id = (select auth.uid()) and public.can_write_story(story_id))
  with check (author_id = (select auth.uid()) and public.can_write_story(story_id));

create policy "authors and co-hosts delete note replies"
  on public.note_replies for delete
  to authenticated
  using (
    (author_id = (select auth.uid()) or public.story_role(story_id) >= 'cohost')
    and public.can_write_story(story_id)
  );

revoke all on public.notes from anon, authenticated;
grant select on public.notes to authenticated;
grant update (body) on public.notes to authenticated;
grant delete on public.notes to authenticated;

revoke all on public.note_replies from anon, authenticated;
grant select on public.note_replies to authenticated;
grant update (body) on public.note_replies to authenticated;
grant delete on public.note_replies to authenticated;

-- Realtime checks the select policies per subscriber, so Viewers and removed Writers receive nothing.
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.note_replies;

-- Sidebar open-Note counts.
create trigger story_changed after insert or delete or update of resolved_at on public.notes
  for each row execute function public.story_changed();

-- Notifications about a Note go when the Note (or its Chapter) does.
alter table public.notifications
  add column note_id uuid references public.notes (id) on delete cascade;

create index notifications_note_idx on public.notifications (note_id) where note_id is not null;

-- Gains p_note. Dropped and recreated rather than replaced, which would add a second, ambiguous overload.
drop function public.notify(uuid[], public.notification_kind, uuid, jsonb, uuid);

-- The actor is left out of the recipients, so callers can pass every member.
create function public.notify(
  p_recipients uuid[],
  p_kind public.notification_kind,
  p_story uuid,
  p_detail jsonb default '{}',
  p_invite uuid default null,
  p_note uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, actor_id, kind, story_id, story_title, invite_id, note_id, detail)
  select r, (select auth.uid()), p_kind, s.id, s.title, p_invite, p_note, coalesce(p_detail, '{}')
  from unnest(p_recipients) r
  join public.stories s on s.id = p_story
  where r is distinct from (select auth.uid());
$$;

-- Not on a locked Chapter: its sync connections are read-only, so nobody could write the mark.
create function public.add_note(p_id uuid, p_chapter uuid, p_quote text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch record;
begin
  select story_id, locked into ch from public.chapters where id = p_chapter;
  if not found or public.story_role(ch.story_id) is null then
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
end;
$$;

-- Tells everyone in the thread who's still in the story: the Note's author and earlier repliers.
create function public.reply_note(p_note uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
  new_id uuid;
begin
  select id, story_id, chapter_id, author_id into n from public.notes where id = p_note;
  if not found or public.story_role(n.story_id) is null then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.note_replies (note_id, story_id, chapter_id, author_id, body)
  values (n.id, n.story_id, n.chapter_id, (select auth.uid()), btrim(p_body))
  returning id into new_id;

  perform public.notify(
    array(
      select distinct p.id
      from (select n.author_id as id union select author_id from public.note_replies where note_id = n.id) p
      where p.id = any (public.story_member_ids(n.story_id))
    ),
    'note_reply',
    n.story_id,
    jsonb_build_object(
      'chapter_id', n.chapter_id,
      'chapter_title', (select title from public.chapters where id = n.chapter_id),
      'excerpt', left(btrim(p_body), 140)
    ),
    null,
    n.id
  );
  return new_id;
end;
$$;

-- Any Writer resolves or reopens. Resolving someone else's Note tells them.
create function public.set_note_resolved(p_note uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
begin
  select id, story_id, chapter_id, author_id, quote into n from public.notes where id = p_note;
  if not found or public.story_role(n.story_id) is null then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  update public.notes
  set resolved_at = case when p_resolved then now() end,
      resolved_by = case when p_resolved then (select auth.uid()) end
  where id = n.id and (resolved_at is not null) is distinct from p_resolved;
  if found and p_resolved and n.author_id = any (public.story_member_ids(n.story_id)) then
    perform public.notify(
      array[n.author_id],
      'note_resolved',
      n.story_id,
      jsonb_build_object(
        'chapter_id', n.chapter_id,
        'chapter_title', (select title from public.chapters where id = n.chapter_id),
        'excerpt', left(n.quote, 140)
      ),
      null,
      n.id
    );
  end if;
end;
$$;

revoke execute on function public.set_edited_at() from public, anon, authenticated;
revoke execute on function public.notify(uuid[], public.notification_kind, uuid, jsonb, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.add_note(uuid, uuid, text, text) from public, anon;
revoke execute on function public.reply_note(uuid, text) from public, anon;
revoke execute on function public.set_note_resolved(uuid, boolean) from public, anon;
