-- Notes that aren't on a passage. A null quote is a Note on a whole Chapter or Entry; with both document ids
-- null too, it's a Story Note.

alter table public.notes
  alter column quote drop not null,
  drop constraint notes_one_document,
  add constraint notes_one_document check (num_nonnulls(chapter_id, entry_id) <= 1),
  add constraint notes_story_unquoted check (quote is null or num_nonnulls(chapter_id, entry_id) = 1);

alter table public.note_replies
  drop constraint note_replies_one_document,
  add constraint note_replies_one_document check (num_nonnulls(chapter_id, entry_id) <= 1);

create index notes_story_notes_idx on public.notes (story_id, created_at) where chapter_id is null and entry_id is null;

-- is_writer() is false in a trashed Story, so Story Notes need no liveness check of their own.
drop policy "writers read notes" on public.notes;
create policy "writers read notes"
  on public.notes for select
  to authenticated
  using (
    public.is_writer(story_id)
    and (
      chapter_id is not null and public.chapter_live(chapter_id)
      or entry_id is not null and public.entry_live(entry_id)
      or chapter_id is null and entry_id is null
    )
  );

drop policy "writers read note replies" on public.note_replies;
create policy "writers read note replies"
  on public.note_replies for select
  to authenticated
  using (
    public.is_writer(story_id)
    and (
      chapter_id is not null and public.chapter_live(chapter_id)
      or entry_id is not null and public.entry_live(entry_id)
      or chapter_id is null and entry_id is null
    )
  );

create or replace function public.note_detail(p_chapter uuid, p_entry uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case
    when p_chapter is not null then jsonb_build_object(
      'chapter_id', p_chapter,
      'chapter_title', (select title from public.chapters where id = p_chapter)
    )
    when p_entry is not null then jsonb_build_object(
      'entry_id', p_entry,
      'entry_name', (select name from public.entries where id = p_entry)
    )
    else '{}'::jsonb
  end;
$$;

-- A null or blank quote makes a Note on the whole Chapter.
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
  values (
    p_id, ch.story_id, p_chapter, (select auth.uid()),
    nullif(left(btrim(coalesce(p_quote, '')), 300), ''), btrim(p_body)
  );

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

-- A null or blank quote makes a Note on the whole Entry.
create or replace function public.add_entry_note(p_id uuid, p_entry uuid, p_quote text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  en record;
begin
  select story_id into en from public.entries where id = p_entry and deleted_at is null;
  if not found or not public.is_writer(en.story_id) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(en.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.notes (id, story_id, entry_id, author_id, quote, body)
  values (
    p_id, en.story_id, p_entry, (select auth.uid()),
    nullif(left(btrim(coalesce(p_quote, '')), 300), ''), btrim(p_body)
  );

  perform public.notify(
    public.writer_mention_ids(p_body, en.story_id),
    'note_mention',
    en.story_id,
    public.note_detail(null, p_entry)
      || jsonb_build_object('excerpt', left(public.writer_mention_text(btrim(p_body)), 140)),
    null,
    p_id
  );
end;
$$;

create function public.add_story_note(p_id uuid, p_story uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_writer(p_story) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(p_story) then
    raise exception 'story_finished';
  end if;

  insert into public.notes (id, story_id, author_id, body)
  values (p_id, p_story, (select auth.uid()), btrim(p_body));

  perform public.notify(
    public.writer_mention_ids(p_body, p_story),
    'note_mention',
    p_story,
    jsonb_build_object('excerpt', left(public.writer_mention_text(btrim(p_body)), 140)),
    null,
    p_id
  );
end;
$$;

-- A Note without a quote is excerpted by its body.
create or replace function public.set_note_resolved(p_note uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
begin
  select id, story_id, chapter_id, entry_id, author_id, quote, body into n from public.notes where id = p_note;
  if not found or not public.is_writer(n.story_id) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  update public.notes
  set resolved_at = case when p_resolved then now() end,
      resolved_by = case when p_resolved then (select auth.uid()) end
  where id = n.id and (resolved_at is not null) is distinct from p_resolved;
  if found and p_resolved and n.author_id = any (public.story_writer_ids(n.story_id)) then
    perform public.notify(
      array[n.author_id],
      'note_resolved',
      n.story_id,
      public.note_detail(n.chapter_id, n.entry_id)
        || jsonb_build_object('excerpt', left(coalesce(n.quote, public.writer_mention_text(n.body)), 140)),
      null,
      n.id
    );
  end if;
end;
$$;

revoke execute on function public.add_story_note(uuid, uuid, text) from public, anon;
