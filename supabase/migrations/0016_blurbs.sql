-- A Story's Blurb: a line or two by its Host, shown under the title wherever the title is.

alter table public.stories
  add column blurb text check (blurb is null or char_length(blurb) between 1 and 280);

grant update (blurb) on public.stories to authenticated;

drop trigger story_changed on public.stories;
create trigger story_changed after update of title, visibility, status, blurb on public.stories
  for each row execute function public.story_changed();

-- Return types change, so drop and recreate rather than replace.
drop function public.live_public_stories();
drop function public.public_stories();

create function public.live_public_stories()
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
    and not s.hidden_from_front
    and a.writers > 0
    and (select coalesce(sum(c.word_count), 0) from public.chapters c where c.story_id = s.id) >= 200
  order by a.writers desc, a.viewers desc, s.created_at desc
  limit 3;
$$;

create function public.public_stories()
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
    select max(c.edited_at) as edited_at from public.chapters c where c.story_id = s.id
  ) e on true
  where s.visibility = 'public' and not s.hidden_from_front
  order by coalesce(a.writers, 0) > 0 desc, e.edited_at desc nulls last, s.created_at desc
  limit 50;
$$;

revoke execute on function public.live_public_stories() from public;
revoke execute on function public.public_stories() from public;
grant execute on function public.live_public_stories() to anon, authenticated;
grant execute on function public.public_stories() to anon, authenticated;

-- A new parameter would add an overload beside the old one, so drop it first.
drop function public.create_story(text, public.story_visibility);

create function public.create_story(
  p_title text,
  p_visibility public.story_visibility,
  p_blurb text default null
)
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

  insert into public.stories (title, visibility, blurb)
  values (btrim(p_title), p_visibility, nullif(btrim(p_blurb), ''))
  returning id into new_id;
  insert into public.story_members (story_id, user_id, role) values (new_id, (select auth.uid()), 'host');
  insert into public.chapters (story_id, position, title) values (new_id, 1, 'Chapter 1');
  return new_id;
end;
$$;

revoke execute on function public.create_story(text, public.story_visibility, text) from public, anon;
grant execute on function public.create_story(text, public.story_visibility, text) to authenticated;
