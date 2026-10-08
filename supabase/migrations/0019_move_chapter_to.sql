drop function public.move_chapter(uuid, integer);

-- Moves the Chapter to just after p_after (null puts it first). Naming the neighbor rather than an index
-- means a drop still lands beside the Chapter it was dropped next to when another Co-host reordered meanwhile.
create function public.move_chapter_to(p_chapter uuid, p_after uuid default null)
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
  select * into ch from public.chapters where id = p_chapter;
  if not found or public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  if (select status from public.stories where id = ch.story_id for update) = 'finished' then
    raise exception 'story_finished';
  end if;
  if p_after = p_chapter then
    return;
  end if;
  if p_after is not null
    and not exists (select 1 from public.chapters where id = p_after and story_id = ch.story_id) then
    raise exception 'chapter_list_changed';
  end if;

  ids := array(
    select id from public.chapters where story_id = ch.story_id and id <> p_chapter order by position
  );
  k := coalesce(array_position(ids, p_after), 0);
  ids := ids[1:k] || p_chapter || ids[k + 1:];

  -- Also closes gaps left by delete_chapter.
  update public.chapters c
  set position = o.ord
  from unnest(ids) with ordinality o(id, ord)
  where c.id = o.id and c.position is distinct from o.ord;
end;
$$;

revoke execute on function public.move_chapter_to(uuid, uuid) from public, anon;
