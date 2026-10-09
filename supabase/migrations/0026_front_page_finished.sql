-- The front page's "Recently Finished", shown when nothing is being written: the three latest Finished Public Stories.

create function public.finished_public_stories()
returns table (id uuid, title text, blurb text, writers integer, chapters integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.title,
    s.blurb,
    (select count(*)::integer from public.story_members m where m.story_id = s.id),
    (select count(*)::integer from public.chapters c where c.story_id = s.id)
  from public.stories s
  where s.visibility = 'public'
    and not s.hidden_from_front
    and s.status = 'finished'
  order by s.finished_at desc nulls last
  limit 3;
$$;

revoke execute on function public.finished_public_stories() from public;
grant execute on function public.finished_public_stories() to anon, authenticated;
