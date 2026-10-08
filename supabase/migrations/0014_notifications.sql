-- Notifications. Written only from inside the RPCs below, through notify(); recipients read them and mark
-- them read. Kept indefinitely; deleted only when what they're about goes away (an Invite is used or
-- withdrawn, or the recipient leaves or is removed from the Story).

create type public.notification_kind as enum (
  'invite_received',
  'writer_joined',
  'chapter_added',
  'story_finished',
  'story_deleted',
  'removed',
  'role_changed'
);

-- story_title is copied so a notification still reads right after a rename or once the Story is gone.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind public.notification_kind not null,
  story_id uuid references public.stories (id) on delete set null,
  story_title text not null,
  invite_id uuid references public.invites (id) on delete cascade,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_story_idx on public.notifications (story_id, recipient_id);
create index notifications_invite_idx on public.notifications (invite_id) where invite_id is not null;

alter table public.notifications enable row level security;

create policy "recipients read their notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "recipients mark their notifications read"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

-- The actor is left out of the recipients, so callers can pass every member.
create function public.notify(
  p_recipients uuid[],
  p_kind public.notification_kind,
  p_story uuid,
  p_detail jsonb default '{}',
  p_invite uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, actor_id, kind, story_id, story_title, invite_id, detail)
  select r, (select auth.uid()), p_kind, s.id, s.title, p_invite, coalesce(p_detail, '{}')
  from unnest(p_recipients) r
  join public.stories s on s.id = p_story
  where r is distinct from (select auth.uid());
$$;

create function public.story_member_ids(p_story uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(user_id), '{}') from public.story_members where story_id = p_story;
$$;

-- Everything about a Story except "You were removed", for someone who's no longer in it.
create function public.forget_story_notifications(p_story uuid, p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notifications
  where story_id = p_story and recipient_id = p_user and kind <> 'removed';
$$;

create function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where recipient_id = (select auth.uid()) and read_at is null;
$$;

-- RPCs that now notify. Bodies match their latest versions apart from the notify and cleanup lines.

create or replace function public.set_member_role(p_story uuid, p_user uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is distinct from 'host' or p_role = 'host' then
    raise exception 'not_allowed';
  end if;

  update public.story_members set role = p_role
  where story_id = p_story and user_id = p_user and role <> 'host' and role <> p_role;
  if found then
    perform public.notify(array[p_user], 'role_changed', p_story, jsonb_build_object('role', p_role));
  elsif not exists (select 1 from public.story_members where story_id = p_story and user_id = p_user and role <> 'host') then
    raise exception 'not_member';
  end if;
end;
$$;

create or replace function public.remove_member(p_story uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.member_role := public.story_role(p_story);
  target public.member_role;
begin
  select role into target from public.story_members where story_id = p_story and user_id = p_user;
  if target is null then
    raise exception 'not_member';
  end if;
  if actor is null or actor < 'cohost' or target = 'host' or (target = 'cohost' and actor <> 'host') then
    raise exception 'not_allowed';
  end if;

  delete from public.story_members where story_id = p_story and user_id = p_user;
  perform public.forget_story_notifications(p_story, p_user);
  perform public.notify(array[p_user], 'removed', p_story);
end;
$$;

create or replace function public.leave_story(p_story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) = 'host' then
    raise exception 'host_cannot_leave';
  end if;
  delete from public.story_members where story_id = p_story and user_id = (select auth.uid());
  perform public.forget_story_notifications(p_story, (select auth.uid()));
end;
$$;

-- The old Host stays on as a Co-host.
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
  where story_id = p_story and user_id = p_user;
  if not found then
    raise exception 'not_member';
  end if;
  perform public.notify(array[p_user], 'role_changed', p_story, jsonb_build_object('role', 'host'));
end;
$$;

create or replace function public.invite_friend(p_story uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if public.story_role(p_story) is null or public.story_role(p_story) < 'cohost' then
    raise exception 'not_allowed';
  end if;
  if not public.are_friends((select auth.uid()), p_user) then
    raise exception 'not_friends';
  end if;
  if exists (select 1 from public.story_members where story_id = p_story and user_id = p_user) then
    raise exception 'already_member';
  end if;

  insert into public.invites (story_id, invited_by, invitee_id)
  values (p_story, (select auth.uid()), p_user)
  on conflict do nothing
  returning id into new_id;
  if new_id is not null then
    perform public.notify(array[p_user], 'invite_received', p_story, '{}', new_id);
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
  select * into inv from public.invites
  where id = p_invite and invitee_id = (select auth.uid()) and used_at is null
  for update;
  if not found then
    raise exception 'invite_not_found';
  end if;

  insert into public.story_members (story_id, user_id) values (inv.story_id, inv.invitee_id)
  on conflict do nothing;
  if found then
    perform public.assign_story_color(inv.story_id, inv.invitee_id);
    perform public.notify(public.story_member_ids(inv.story_id), 'writer_joined', inv.story_id);
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

  select * into inv from public.invites where token = p_token for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if inv.used_at is not null then
    raise exception 'invite_used';
  end if;
  if exists (select 1 from public.story_members where story_id = inv.story_id and user_id = me) then
    raise exception 'already_member';
  end if;

  insert into public.story_members (story_id, user_id) values (inv.story_id, me);
  perform public.assign_story_color(inv.story_id, me);
  update public.invites set used_at = now(), used_by = me where id = inv.id;
  perform public.befriend(inv.invited_by, me);
  perform public.notify(public.story_member_ids(inv.story_id), 'writer_joined', inv.story_id);
  -- A Friend Invite to the same Story has nothing left to join.
  delete from public.notifications n
  using public.invites i
  where n.invite_id = i.id and i.story_id = inv.story_id and i.invitee_id = me;
  return inv.story_id;
end;
$$;

create or replace function public.add_chapter(p_story uuid, p_title text)
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
  perform public.notify(
    public.story_member_ids(p_story),
    'chapter_added',
    p_story,
    jsonb_build_object('chapter_id', new_id, 'chapter_title', btrim(p_title))
  );
  return new_id;
end;
$$;

-- Host only. Finishing locks every Chapter and Entry (apps/sync checks status); reopening unlocks them.
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
  if found and p_finished then
    perform public.notify(public.story_member_ids(p_story), 'story_finished', p_story);
  end if;
end;
$$;

-- Host only. Members hear about it first; their notifications keep the title once story_id is cleared.
create function public.delete_story(p_story uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.story_role(p_story) is distinct from 'host' then
    raise exception 'not_allowed';
  end if;

  perform public.notify(public.story_member_ids(p_story), 'story_deleted', p_story);
  delete from public.stories where id = p_story;
end;
$$;

-- Deleting goes through delete_story so members are always told.
drop policy "hosts delete their story" on public.stories;

revoke execute on function public.notify(uuid[], public.notification_kind, uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.story_member_ids(uuid) from public, anon, authenticated;
revoke execute on function public.forget_story_notifications(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mark_notifications_read() from public, anon;
revoke execute on function public.delete_story(uuid) from public, anon;
