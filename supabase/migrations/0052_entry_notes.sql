-- Notes on Story Bible Entries. A Note belongs to exactly one Chapter or Entry; replies copy whichever it is.

alter table public.notes
  add column entry_id uuid references public.entries (id) on delete cascade,
  alter column chapter_id drop not null,
  add constraint notes_one_document check (num_nonnulls(chapter_id, entry_id) = 1);

alter table public.note_replies
  add column entry_id uuid references public.entries (id) on delete cascade,
  alter column chapter_id drop not null,
  add constraint note_replies_one_document check (num_nonnulls(chapter_id, entry_id) = 1);

create index notes_entry_idx on public.notes (entry_id, created_at);
create index note_replies_entry_idx on public.note_replies (entry_id);

drop policy "writers read notes" on public.notes;
create policy "writers read notes"
  on public.notes for select
  to authenticated
  using (
    public.is_writer(story_id)
    and (chapter_id is not null and public.chapter_live(chapter_id) or entry_id is not null and public.entry_live(entry_id))
  );

drop policy "writers read note replies" on public.note_replies;
create policy "writers read note replies"
  on public.note_replies for select
  to authenticated
  using (
    public.is_writer(story_id)
    and (chapter_id is not null and public.chapter_live(chapter_id) or entry_id is not null and public.entry_live(entry_id))
  );

-- Where a Note notification points, without its excerpt.
create function public.note_detail(p_chapter uuid, p_entry uuid)
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
    else jsonb_build_object(
      'entry_id', p_entry,
      'entry_name', (select name from public.entries where id = p_entry)
    )
  end;
$$;

create function public.add_entry_note(p_id uuid, p_entry uuid, p_quote text, p_body text)
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
  values (p_id, en.story_id, p_entry, (select auth.uid()), left(btrim(p_quote), 300), btrim(p_body));

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

create or replace function public.reply_note(p_note uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
  new_id uuid;
  mentioned uuid[];
  detail jsonb;
begin
  select id, story_id, chapter_id, entry_id, author_id, body into n from public.notes where id = p_note;
  if not found or not public.is_writer(n.story_id) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.note_replies (note_id, story_id, chapter_id, entry_id, author_id, body)
  values (n.id, n.story_id, n.chapter_id, n.entry_id, (select auth.uid()), btrim(p_body))
  returning id into new_id;

  mentioned := public.writer_mention_ids(p_body, n.story_id);
  detail := public.note_detail(n.chapter_id, n.entry_id)
    || jsonb_build_object('excerpt', left(public.writer_mention_text(btrim(p_body)), 140));

  perform public.notify(mentioned, 'note_mention', n.story_id, detail, null, n.id);
  perform public.notify(
    array(
      select distinct p.id
      from (
        select n.author_id as id
        union select author_id from public.note_replies where note_id = n.id
        union select unnest(public.writer_mention_ids(n.body, n.story_id))
        union select unnest(public.writer_mention_ids(r.body, n.story_id)) from public.note_replies r where r.note_id = n.id
      ) p
      where p.id = any (public.story_writer_ids(n.story_id)) and not (p.id = any (mentioned))
    ),
    'note_reply',
    n.story_id,
    detail,
    null,
    n.id
  );
  return new_id;
end;
$$;

create or replace function public.set_note_resolved(p_note uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
begin
  select id, story_id, chapter_id, entry_id, author_id, quote into n from public.notes where id = p_note;
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
      public.note_detail(n.chapter_id, n.entry_id) || jsonb_build_object('excerpt', left(n.quote, 140)),
      null,
      n.id
    );
  end if;
end;
$$;

create or replace function public.notify_added_writer_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  added uuid[];
  note uuid;
begin
  added := array(
    select unnest(public.writer_mention_ids(new.body, new.story_id))
    except
    select unnest(public.writer_mention_ids(old.body, new.story_id))
  );
  if cardinality(added) = 0 then
    return null;
  end if;

  -- Separate statements: plpgsql would reject new.note_id on notes even in an untaken branch of one expression.
  if tg_table_name = 'notes' then
    note := new.id;
  else
    note := new.note_id;
  end if;

  perform public.notify(
    added,
    'note_mention',
    new.story_id,
    public.note_detail(new.chapter_id, new.entry_id)
      || jsonb_build_object('excerpt', left(public.writer_mention_text(new.body), 140)),
    null,
    note
  );
  return null;
end;
$$;

revoke execute on function public.note_detail(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.add_entry_note(uuid, uuid, text, text) from public, anon;
