-- Writer Mentions in Story Chat. Messages are never edited, so only inserts notify. Chat stays open in a
-- Finished Story, but mentions there notify nobody.

create function public.notify_chat_writer_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_write_story(new.story_id) then
    return null;
  end if;

  perform public.notify(
    public.writer_mention_ids(new.body, new.story_id),
    'chat_mention',
    new.story_id,
    jsonb_build_object('message_id', new.id, 'excerpt', left(public.writer_mention_text(new.body), 140))
  );
  return null;
end;
$$;

create trigger notify_chat_writer_mentions after insert on public.chat_messages
  for each row execute function public.notify_chat_writer_mentions();

revoke execute on function public.notify_chat_writer_mentions() from public, anon, authenticated;
