-- The front page's "Being written now" and the public Stories list. Both list Public Stories only, and
-- name nobody: a title and live counts. hidden_from_front is set from the dashboard, so it gets no grant.

alter table public.stories add column hidden_from_front boolean not null default false;

-- Public Stories with a Writer in them right now and about 200 words or more, busiest first.
create function public.live_public_stories()
returns table (id uuid, title text, writers integer, viewers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, a.writers, a.viewers
  from public.stories s
  join public.story_activity a on a.story_id = s.id
  where s.visibility = 'public'
    and not s.hidden_from_front
    and a.writers > 0
    and (select coalesce(sum(c.word_count), 0) from public.chapters c where c.story_id = s.id) >= 200
  order by a.writers desc, a.viewers desc, s.created_at desc
  limit 3;
$$;

-- Every Public Story not hidden from the front page: the ones being written first, then by latest edit.
create function public.public_stories()
returns table (
  id uuid,
  title text,
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
  select s.id, s.title, s.status, coalesce(a.writers, 0), coalesce(a.viewers, 0), e.edited_at
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
