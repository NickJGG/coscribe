-- A User's Writing Days for their profile heatmap, all-time so the longest Streak is too. Security definer
-- because writing_days has no grants, and "today" needs their private time_zone. Null when they've hidden it
-- (except to themselves).
create function public.writing_history(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'today', (now() at time zone coalesce(p.time_zone, 'UTC'))::date,
    'hidden', not p.show_writing_days,
    'days', coalesce((
      select jsonb_agg(jsonb_build_array(w.day, w.minutes) order by w.day)
      from public.writing_days w
      where w.user_id = p.id
    ), '[]')
  )
  from public.profiles p
  where p.id = p_user
    and (p.show_writing_days or p.id = (select auth.uid()));
$$;

revoke execute on function public.writing_history(uuid) from public;
grant execute on function public.writing_history(uuid) to anon, authenticated;

create or replace function public.account_export()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id)
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'username', p.username,
        'author_color', p.author_color,
        'bio', p.bio,
        'theme', p.theme,
        'show_online', p.show_online,
        'show_writing_days', p.show_writing_days,
        'time_zone', p.time_zone,
        'created_at', p.created_at
      )
      from public.profiles p, me where p.id = me.id
    ),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'status', f.status, 'since', f.created_at)
        order by p.username)
      from public.friendships f
      cross join me
      join public.profiles p
        on p.id = case when f.requester_id = me.id then f.addressee_id else f.requester_id end
      where me.id in (f.requester_id, f.addressee_id)
    ), '[]'),
    'stories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', s.title, 'role', m.role, 'joined_at', m.joined_at, 'in_trash', s.deleted_at is not null
      ) order by m.joined_at)
      from public.story_members m
      cross join me
      join public.stories s on s.id = m.story_id
      where m.user_id = me.id
    ), '[]'),
    'story_chat', coalesce((
      select jsonb_agg(jsonb_build_object('story', s.title, 'body', c.body, 'created_at', c.created_at)
        order by c.created_at)
      from public.chat_messages c
      cross join me
      join public.stories s on s.id = c.story_id
      where c.user_id = me.id
    ), '[]'),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'story', s.title, 'quote', n.quote, 'body', n.body,
        'created_at', n.created_at, 'edited_at', n.edited_at, 'resolved_at', n.resolved_at
      ) order by n.created_at)
      from public.notes n
      cross join me
      join public.stories s on s.id = n.story_id
      where n.author_id = me.id
    ), '[]'),
    'note_replies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'story', s.title, 'quote', n.quote, 'body', r.body, 'created_at', r.created_at, 'edited_at', r.edited_at
      ) order by r.created_at)
      from public.note_replies r
      cross join me
      join public.notes n on n.id = r.note_id
      join public.stories s on s.id = r.story_id
      where r.author_id = me.id
    ), '[]'),
    'featured_passage', (
      select jsonb_build_object(
        'story', s.title, 'chapter', ch.title, 'content', fp.content, 'created_at', fp.created_at
      )
      from public.featured_passages fp
      cross join me
      join public.stories s on s.id = fp.story_id
      join public.chapters ch on ch.id = fp.chapter_id
      where fp.user_id = me.id
    ),
    'writing_days', coalesce((
      select jsonb_agg(jsonb_build_object('day', w.day, 'minutes', w.minutes) order by w.day)
      from public.writing_days w, me
      where w.user_id = me.id
    ), '[]')
  );
$$;
