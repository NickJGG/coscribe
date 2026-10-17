-- What an Invite Link's share card shows. Like invite_link_preview, it reveals a Private Story's title to
-- anyone holding the link, and adds its Blurb and Writers, since the invitee sees them a click later.
-- Only a live link (unused, unexpired, Story not deleted) returns a row.

create function public.invite_link_card(p_token text)
returns table (
  story_title text,
  story_blurb text,
  role public.member_role,
  expires_at timestamptz,
  inviter_username text,
  inviter_color text,
  writers jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.title, s.blurb, i.role, i.expires_at, p.username,
    coalesce(im.author_color, p.author_color),
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', w.user_id, 'username', wp.username,
          'color', coalesce(w.author_color, wp.author_color),
          'chars', coalesce((
            select sum(coalesce((ch.author_chars ->> w.user_id::text)::numeric, 0))
            from public.chapters ch
            where ch.story_id = s.id and ch.deleted_at is null
          ), 0))
        order by w.role = 'host' desc, w.joined_at)
      from public.story_members w
      join public.profiles wp on wp.id = w.user_id
      where w.story_id = s.id and w.role in ('host', 'cohost', 'writer')
    ), '[]')
  from public.invites i
  join public.stories s on s.id = i.story_id and s.deleted_at is null
  join public.profiles p on p.id = i.invited_by
  left join public.story_members im on im.story_id = s.id and im.user_id = i.invited_by
  where i.token = p_token
    and i.used_at is null
    and (i.expires_at is null or i.expires_at > now());
$$;

revoke execute on function public.invite_link_card(text) from public;
grant execute on function public.invite_link_card(text) to anon, authenticated;
