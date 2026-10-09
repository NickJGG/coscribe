-- Writer Mentions in Notes and replies. A body stores each as `@[<profile id>]`; only current members of
-- the Story count. Being mentioned in a thread makes you part of it, so later replies tell you too. That's
-- worked out from the bodies, so nothing here tracks it.

create function public.writer_mention_ids(p_body text, p_story uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct m.g[1]::uuid), '{}')
  from regexp_matches(
    coalesce(p_body, ''),
    '@\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]',
    'g'
  ) as m(g)
  where m.g[1]::uuid = any (public.story_member_ids(p_story));
$$;

-- For notification excerpts, so the bell never shows ids.
create function public.writer_mention_text(p_body text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result text := p_body;
  token text;
begin
  for token in
    select distinct m.g[1]
    from regexp_matches(
      coalesce(p_body, ''),
      '@\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]',
      'g'
    ) as m(g)
  loop
    result := replace(
      result,
      '@[' || token || ']',
      '@' || coalesce((select username from public.profiles where id = token::uuid), 'someone')
    );
  end loop;
  return result;
end;
$$;

-- Bodies match 0018 apart from the mention lines.
create or replace function public.add_note(p_id uuid, p_chapter uuid, p_quote text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch record;
begin
  select story_id, locked, title into ch from public.chapters where id = p_chapter;
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

-- Whoever this reply mentions hears about the mention; everyone else in the thread who's still in the
-- story hears about the reply: the Note's author, earlier repliers, and anyone mentioned before.
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
  select id, story_id, chapter_id, author_id, body into n from public.notes where id = p_note;
  if not found or public.story_role(n.story_id) is null then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.note_replies (note_id, story_id, chapter_id, author_id, body)
  values (n.id, n.story_id, n.chapter_id, (select auth.uid()), btrim(p_body))
  returning id into new_id;

  mentioned := public.writer_mention_ids(p_body, n.story_id);
  detail := jsonb_build_object(
    'chapter_id', n.chapter_id,
    'chapter_title', (select title from public.chapters where id = n.chapter_id),
    'excerpt', left(public.writer_mention_text(btrim(p_body)), 140)
  );

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
      where p.id = any (public.story_member_ids(n.story_id)) and not (p.id = any (mentioned))
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

-- Edits stay direct updates, so this runs as the editor and auth.uid() is the actor. Only Writers the
-- edit newly mentions hear about it.
create function public.notify_added_writer_mentions()
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
    jsonb_build_object(
      'chapter_id', new.chapter_id,
      'chapter_title', (select title from public.chapters where id = new.chapter_id),
      'excerpt', left(public.writer_mention_text(new.body), 140)
    ),
    null,
    note
  );
  return null;
end;
$$;

create trigger notify_added_writer_mentions after update of body on public.notes
  for each row when (old.body is distinct from new.body) execute function public.notify_added_writer_mentions();
create trigger notify_added_writer_mentions after update of body on public.note_replies
  for each row when (old.body is distinct from new.body) execute function public.notify_added_writer_mentions();

revoke execute on function public.writer_mention_ids(text, uuid) from public, anon, authenticated;
revoke execute on function public.writer_mention_text(text) from public, anon, authenticated;
revoke execute on function public.notify_added_writer_mentions() from public, anon, authenticated;
