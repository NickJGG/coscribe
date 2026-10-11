-- Co-hosts order the Story Bible by hand: Entries within their Entry Type, and the four Entry Types themselves.

alter table public.entries add column position integer;

update public.entries e
set position = o.ord
from (
  select id, row_number() over (partition by story_id, type order by name, created_at) as ord
  from public.entries
) o
where e.id = o.id;

-- place_entry overwrites the default; it only keeps position optional on insert.
alter table public.entries alter column position set not null, alter column position set default 0;

create index entries_story_type_position_idx on public.entries (story_id, type, position);

grant select (position) on public.entries to anon, authenticated;

-- A new Entry, or one whose type changes, goes to the bottom of its type.
-- Inserts don't pass a position, so code written before this migration keeps working.
create function public.place_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.type = old.type then
    return new;
  end if;

  -- Lock the story row so two Writers adding at once don't pick the same position.
  perform 1 from public.stories where id = new.story_id for update;
  new.position := coalesce(
    (select max(position) from public.entries where story_id = new.story_id and type = new.type), 0
  ) + 1;
  return new;
end;
$$;

revoke execute on function public.place_entry() from public, anon, authenticated;

create trigger place_entry before insert or update of type on public.entries
  for each row execute function public.place_entry();

-- Always all four types, so an empty type keeps its place.
alter table public.stories
  add column entry_type_order public.entry_type[] not null default '{character,place,item,lore}'
  check (cardinality(entry_type_order) = 4 and entry_type_order @> '{character,place,item,lore}');

-- Moves the Entry to just after p_after (null puts it first) within its type. See move_chapter_to for why
-- it names a neighbor.
create function public.move_entry_to(p_entry uuid, p_after uuid default null)
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
  select * into en from public.entries where id = p_entry;
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
    select 1 from public.entries where id = p_after and story_id = en.story_id and type = en.type
  ) then
    raise exception 'entry_list_changed';
  end if;

  ids := array(
    select id from public.entries
    where story_id = en.story_id and type = en.type and id <> p_entry
    order by position
  );
  k := coalesce(array_position(ids, p_after), 0);
  ids := ids[1:k] || p_entry || ids[k + 1:];

  -- Also closes gaps left by deletes.
  update public.entries e
  set position = o.ord
  from unnest(ids) with ordinality o(id, ord)
  where e.id = o.id and e.position is distinct from o.ord;
end;
$$;

-- Moves the Entry Type to just after p_after (null puts it first). The client names the visible neighbor,
-- so hidden empty types keep their slots relative to the others.
create function public.move_entry_type_to(
  p_story uuid,
  p_type public.entry_type,
  p_after public.entry_type default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  types public.entry_type[];
  k integer;
begin
  if public.story_role(p_story) is null or public.story_role(p_story) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  if (select status from public.stories where id = p_story for update) = 'finished' then
    raise exception 'story_finished';
  end if;
  if p_after = p_type then
    return;
  end if;

  types := array_remove((select entry_type_order from public.stories where id = p_story), p_type);
  k := coalesce(array_position(types, p_after), 0);
  update public.stories
  set entry_type_order = types[1:k] || p_type || types[k + 1:]
  where id = p_story;
end;
$$;

revoke execute on function public.move_entry_to(uuid, uuid) from public, anon;
revoke execute on function public.move_entry_type_to(uuid, public.entry_type, public.entry_type) from public, anon;

-- The story_changed triggers from 0013 and 0016 don't watch these columns.
create trigger story_changed_entry_position after update of position on public.entries
  for each row execute function public.story_changed();
create trigger story_changed_entry_type_order after update of entry_type_order on public.stories
  for each row execute function public.story_changed();
