-- Notifications for friend requests and acceptances, Host transfer and Reopen.
-- Friend notifications have no Story. They hang off the friendships row, so a decline, cancel or unfriend
-- removes them with it.

alter table public.notifications alter column story_title drop not null;

alter table public.notifications
  add column friend_requester uuid,
  add column friend_addressee uuid,
  add foreign key (friend_requester, friend_addressee)
    references public.friendships (requester_id, addressee_id) on delete cascade;

create index notifications_friendship_idx on public.notifications (friend_requester, friend_addressee)
  where friend_requester is not null;

-- 'mine' drops the Story-wide news (new Chapters, new Writers, a new Host); everything else is already about
-- the recipient, or (Finished, Reopened, deleted) wanted by everyone.
create or replace function public.notify(
  p_recipients uuid[],
  p_kind public.notification_kind,
  p_story uuid,
  p_detail jsonb default '{}',
  p_invite uuid default null,
  p_note uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, actor_id, kind, story_id, story_title, invite_id, note_id, detail)
  select r, (select auth.uid()), p_kind, s.id, s.title, p_invite, p_note, coalesce(p_detail, '{}')
  from unnest(p_recipients) r
  join public.stories s on s.id = p_story
  where r is distinct from (select auth.uid())
    and not (
      p_kind in ('writer_joined', 'chapter_added', 'host_changed')
      and exists (
        select 1 from public.story_members m
        where m.story_id = p_story and m.user_id = r and m.notify = 'mine'
      )
    );
$$;

create function public.notify_friend(
  p_recipient uuid,
  p_kind public.notification_kind,
  p_requester uuid,
  p_addressee uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, actor_id, kind, friend_requester, friend_addressee)
  values (p_recipient, (select auth.uid()), p_kind, p_requester, p_addressee);
$$;

create function public.send_friend_request(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or p_user is null or p_user = me then
    raise exception 'not_allowed';
  end if;
  if exists (
    select 1 from public.friendships
    where (requester_id = me and addressee_id = p_user) or (requester_id = p_user and addressee_id = me)
  ) then
    raise exception 'already_connected';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, p_user);
  perform public.notify_friend(p_user, 'friend_request', me, p_user);
end;
$$;

create function public.accept_friend_request(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  update public.friendships set status = 'accepted'
  where requester_id = p_user and addressee_id = me and status = 'pending';
  if not found then
    raise exception 'not_found';
  end if;

  delete from public.notifications
  where friend_requester = p_user and friend_addressee = me and kind = 'friend_request';
  perform public.notify_friend(p_user, 'friend_accepted', p_user, me);
end;
$$;

-- Declines, cancels, or unfriends.
create function public.remove_friendship(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
  where (requester_id = (select auth.uid()) and addressee_id = p_user)
     or (requester_id = p_user and addressee_id = (select auth.uid()));
$$;

-- The other Writers hear who the new Host is; the new Host keeps their role_changed.
create or replace function public.transfer_host(p_story uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is distinct from 'host' or p_user = (select auth.uid()) then
    raise exception 'not_allowed';
  end if;

  update public.story_members set role = 'cohost'
  where story_id = p_story and user_id = (select auth.uid());
  update public.story_members set role = 'host'
  where story_id = p_story and user_id = p_user and role >= 'writer';
  if not found then
    raise exception 'not_member';
  end if;
  perform public.notify(array[p_user], 'role_changed', p_story, jsonb_build_object('role', 'host'));
  perform public.notify(
    array_remove(public.story_writer_ids(p_story), p_user),
    'host_changed',
    p_story,
    jsonb_build_object('host_username', (select username from public.profiles where id = p_user))
  );
end;
$$;

-- Finishing tells every member; reopening tells only those who can write again.
create or replace function public.set_story_finished(p_story uuid, p_finished boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is distinct from 'host' then
    raise exception 'not_allowed';
  end if;

  update public.stories
  set status = case when p_finished then 'finished' else 'active' end::public.story_status,
      finished_at = case when p_finished then now() end
  where id = p_story and (status = 'finished') is distinct from p_finished;
  if found then
    perform public.notify(
      case when p_finished then public.story_member_ids(p_story) else public.story_writer_ids(p_story) end,
      case when p_finished then 'story_finished' else 'story_reopened' end::public.notification_kind,
      p_story
    );
  end if;
end;
$$;

revoke execute on function public.notify_friend(uuid, public.notification_kind, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
revoke execute on function public.remove_friendship(uuid) from public, anon;
