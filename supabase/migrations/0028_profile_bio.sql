-- A User's Bio: one line under their name on their profile, set in Settings.

alter table public.profiles
  add column bio text check (bio is null or char_length(bio) between 1 and 160);

grant select (bio) on public.profiles to anon, authenticated;

-- Where a User is writing right now, for their profile. Like friends_presence(), it shows only a Story
-- the caller could read anyway, and nothing when the User has turned Online off.
create function public.writing_now(p_user uuid)
returns table (
  story_id uuid,
  story_title text,
  chapter_id uuid,
  chapter_title text,
  chapter_number integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, c.id, c.title,
    (select count(*)::integer from public.chapters o where o.story_id = c.story_id and o.position <= c.position)
  from public.story_presence sp
  join public.profiles p on p.id = sp.user_id
  join public.stories s on s.id = sp.story_id
  join public.chapters c on c.id = sp.document_id
  where sp.user_id = p_user
    and sp.kind = 'chapter'
    and public.can_view_story(sp.story_id)
    and p.show_online
    and p.last_seen > now() - interval '2 minutes'
  order by sp.connected_at desc
  limit 1;
$$;

revoke execute on function public.writing_now(uuid) from public;
grant execute on function public.writing_now(uuid) to anon, authenticated;
