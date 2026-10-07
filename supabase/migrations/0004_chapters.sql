-- ydoc holds the Yjs state, read and written only by apps/sync over a direct connection.
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  position integer not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  locked boolean not null default false,
  ydoc bytea,
  created_at timestamptz not null default now(),
  -- Deferred so move_chapter can swap two positions in one statement.
  unique (story_id, position) deferrable initially deferred
);

alter table public.chapters enable row level security;

create policy "chapters of visible stories are readable"
  on public.chapters for select
  to anon, authenticated
  using (public.can_view_story(story_id));

create policy "co-hosts update chapters"
  on public.chapters for update
  to authenticated
  using (public.story_role(story_id) >= 'cohost')
  with check (public.story_role(story_id) >= 'cohost');

revoke all on public.chapters from anon, authenticated;
grant select (id, story_id, position, title, locked, created_at) on public.chapters to anon, authenticated;
grant update (title, locked) on public.chapters to authenticated;

-- Every Story has at least one Chapter.
insert into public.chapters (story_id, position, title)
select id, 1, 'Chapter 1' from public.stories;

create or replace function public.create_story(p_title text, p_visibility public.story_visibility)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in';
  end if;

  insert into public.stories (title, visibility) values (btrim(p_title), p_visibility)
  returning id into new_id;
  insert into public.story_members (story_id, user_id, role) values (new_id, (select auth.uid()), 'host');
  insert into public.chapters (story_id, position, title) values (new_id, 1, 'Chapter 1');
  return new_id;
end;
$$;

create function public.add_chapter(p_story uuid, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if public.story_role(p_story) is null then
    raise exception 'not_allowed';
  end if;
  if (select status from public.stories where id = p_story) = 'finished' then
    raise exception 'story_finished';
  end if;

  -- Lock the story row so two Writers adding at once don't pick the same position.
  perform 1 from public.stories where id = p_story for update;
  insert into public.chapters (story_id, position, title)
  values (
    p_story,
    coalesce((select max(position) from public.chapters where story_id = p_story), 0) + 1,
    btrim(p_title)
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Swaps the Chapter with its neighbor before (p_direction = -1) or after (1). A no-op at either end.
create function public.move_chapter(p_chapter uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.chapters;
  neighbor public.chapters;
begin
  select * into ch from public.chapters where id = p_chapter;
  if not found or public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.stories where id = ch.story_id for update;
  select * into neighbor from public.chapters
  where story_id = ch.story_id
    and case when p_direction < 0 then position < ch.position else position > ch.position end
  order by case when p_direction < 0 then -position else position end
  limit 1;
  if not found then
    return;
  end if;

  update public.chapters
  set position = case id when ch.id then neighbor.position else ch.position end
  where id in (ch.id, neighbor.id);
end;
$$;

create function public.delete_chapter(p_chapter uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch public.chapters;
begin
  select * into ch from public.chapters where id = p_chapter;
  if not found or public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.stories where id = ch.story_id for update;
  if (select count(*) from public.chapters where story_id = ch.story_id) = 1 then
    raise exception 'last_chapter';
  end if;
  delete from public.chapters where id = p_chapter;
end;
$$;

revoke execute on function public.add_chapter(uuid, text) from public, anon;
revoke execute on function public.move_chapter(uuid, integer) from public, anon;
revoke execute on function public.delete_chapter(uuid) from public, anon;
