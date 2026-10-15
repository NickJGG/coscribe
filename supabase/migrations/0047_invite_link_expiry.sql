-- Invite Links last 1, 7 or 30 days; Friend Invites keep a null expires_at. Unused links are purged 30 days
-- after they expire, so until then /invite/[token] can still say "expired".
-- Writers are capped at the palette size (0009), Host included. Pending Invites don't hold a seat.

alter table public.invites add column expires_at timestamptz;

update public.invites set expires_at = now() + interval '7 days'
where token is not null and used_at is null;

create function public.story_full(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) >= array_length(public.author_palette(), 1)
  from public.story_members
  where story_id = p_story and role <> 'viewer';
$$;

-- The old signature goes so named-arg calls without p_lasts aren't ambiguous.
drop function public.create_invite_link(uuid, public.member_role);

create function public.create_invite_link(
  p_story uuid,
  p_role public.member_role default 'writer',
  p_lasts integer default 7
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
begin
  if public.story_role(p_story) is null or public.story_role(p_story) < 'cohost'
    or p_role not in ('writer', 'viewer') or p_lasts is null or p_lasts not in (1, 7, 30) then
    raise exception 'not_allowed';
  end if;
  if p_role = 'viewer' and (select visibility from public.stories where id = p_story) <> 'private' then
    raise exception 'not_private';
  end if;
  if p_role = 'writer' and not public.story_active(p_story) then
    raise exception 'story_finished';
  end if;
  if p_role = 'writer' and public.story_full(p_story) then
    raise exception 'story_full';
  end if;

  insert into public.invites (story_id, invited_by, token, role, expires_at)
  values (p_story, (select auth.uid()), new_token, p_role, now() + make_interval(days => p_lasts));
  return new_token;
end;
$$;

create or replace function public.invite_friend(p_story uuid, p_user uuid, p_role public.member_role default 'writer')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if public.story_role(p_story) is null or public.story_role(p_story) < 'cohost'
    or p_role not in ('writer', 'viewer') then
    raise exception 'not_allowed';
  end if;
  if p_role = 'viewer' and (select visibility from public.stories where id = p_story) <> 'private' then
    raise exception 'not_private';
  end if;
  if p_role = 'writer' and not public.story_active(p_story) then
    raise exception 'story_finished';
  end if;
  if p_role = 'writer' and public.story_full(p_story) then
    raise exception 'story_full';
  end if;
  if not public.are_friends((select auth.uid()), p_user) then
    raise exception 'not_friends';
  end if;
  if exists (select 1 from public.story_members where story_id = p_story and user_id = p_user) then
    raise exception 'already_member';
  end if;

  insert into public.invites (story_id, invited_by, invitee_id, role)
  values (p_story, (select auth.uid()), p_user, p_role)
  on conflict do nothing
  returning id into new_id;
  if new_id is not null then
    perform public.notify(array[p_user], 'invite_received', p_story, jsonb_build_object('role', p_role), new_id);
  end if;
end;
$$;

create or replace function public.accept_invite(p_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  select i.* into inv from public.invites i
  join public.stories s on s.id = i.story_id and s.deleted_at is null
  where i.id = p_invite and i.invitee_id = (select auth.uid()) and i.used_at is null
  for update of i;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if inv.role = 'writer' and not public.story_active(inv.story_id) then
    raise exception 'story_finished';
  end if;
  if inv.role = 'writer' and public.story_full(inv.story_id)
    and not exists (select 1 from public.story_members where story_id = inv.story_id and user_id = inv.invitee_id) then
    raise exception 'story_full';
  end if;

  insert into public.story_members (story_id, user_id, role) values (inv.story_id, inv.invitee_id, inv.role)
  on conflict do nothing;
  if found and inv.role = 'writer' then
    perform public.assign_story_color(inv.story_id, inv.invitee_id);
    perform public.notify(public.story_writer_ids(inv.story_id), 'writer_joined', inv.story_id);
  end if;
  update public.invites set used_at = now(), used_by = inv.invitee_id where id = inv.id;
  delete from public.notifications where invite_id = inv.id;
  return inv.story_id;
end;
$$;

create or replace function public.accept_invite_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  me uuid := (select auth.uid());
begin
  if me is null or not exists (select 1 from public.profiles where id = me) then
    raise exception 'not_signed_in';
  end if;

  select i.* into inv from public.invites i
  join public.stories s on s.id = i.story_id and s.deleted_at is null
  where i.token = p_token
  for update of i;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if inv.used_at is not null then
    raise exception 'invite_used';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invite_expired';
  end if;
  if exists (select 1 from public.story_members where story_id = inv.story_id and user_id = me) then
    raise exception 'already_member';
  end if;
  if inv.role = 'writer' and not public.story_active(inv.story_id) then
    raise exception 'story_finished';
  end if;
  if inv.role = 'writer' and public.story_full(inv.story_id) then
    raise exception 'story_full';
  end if;

  insert into public.story_members (story_id, user_id, role) values (inv.story_id, me, inv.role);
  update public.invites set used_at = now(), used_by = me where id = inv.id;
  if inv.role = 'writer' then
    perform public.assign_story_color(inv.story_id, me);
    perform public.notify(public.story_writer_ids(inv.story_id), 'writer_joined', inv.story_id);
  end if;
  -- A Friend Invite to the same Story has nothing left to join.
  delete from public.notifications n
  using public.invites i
  where n.invite_id = i.id and i.story_id = inv.story_id and i.invitee_id = me;
  return inv.story_id;
end;
$$;

create or replace function public.set_member_role(p_story uuid, p_user uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.member_role := public.story_role(p_story);
  target public.member_role;
begin
  if actor is null or actor < 'cohost' or p_role = 'host' then
    raise exception 'not_allowed';
  end if;

  select role into target from public.story_members
  where story_id = p_story and user_id = p_user and role <> 'host';
  if target is null then
    raise exception 'not_member';
  end if;
  if target = p_role then
    return;
  end if;

  if 'viewer' in (target, p_role) then
    if 'cohost' in (target, p_role) then
      raise exception 'not_allowed';
    end if;
    if (select visibility from public.stories where id = p_story) <> 'private' then
      raise exception 'not_private';
    end if;
  elsif actor <> 'host' then
    raise exception 'not_allowed';
  end if;
  if target = 'viewer' and public.story_full(p_story) then
    raise exception 'story_full';
  end if;

  update public.story_members set role = p_role where story_id = p_story and user_id = p_user;
  if target = 'viewer' then
    perform public.assign_story_color(p_story, p_user);
  end if;
  perform public.notify(array[p_user], 'role_changed', p_story, jsonb_build_object('role', p_role));
end;
$$;

-- The return type grows, which create or replace can't do.
drop function public.invite_link_preview(text);

create function public.invite_link_preview(p_token text)
returns table (
  story_id uuid,
  story_title text,
  inviter_username text,
  used boolean,
  role public.member_role,
  expired boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, p.username, i.used_at is not null, i.role,
    i.expires_at is not null and i.expires_at <= now()
  from public.invites i
  join public.stories s on s.id = i.story_id and s.deleted_at is null
  join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

create function public.purge_expired_invite_links()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.invites
  where token is not null and used_at is null and expires_at <= now() - interval '30 days';
$$;

select cron.schedule('purge-invite-links', '23 4 * * *', 'select public.purge_expired_invite_links()');

revoke execute on function public.story_full(uuid) from public, anon, authenticated;
revoke execute on function public.create_invite_link(uuid, public.member_role, integer) from public, anon;
revoke execute on function public.invite_link_preview(text) from public;
grant execute on function public.invite_link_preview(text) to anon, authenticated;
revoke execute on function public.purge_expired_invite_links() from public, anon, authenticated;
