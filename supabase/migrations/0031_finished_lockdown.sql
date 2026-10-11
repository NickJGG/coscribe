-- Finished locks Chapter renames and Lock changes, Chapter deletes and new Invites. Pending Invites
-- are kept but can't be accepted until the story is Reopened. Story Chat stays open (see 0024).

create function public.story_active(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.stories where id = p_story and status = 'active');
$$;

drop policy "co-hosts update chapters" on public.chapters;

create policy "co-hosts update chapters"
  on public.chapters for update
  to authenticated
  using (public.story_role(story_id) >= 'cohost' and public.story_active(story_id))
  with check (public.story_role(story_id) >= 'cohost' and public.story_active(story_id));

create or replace function public.delete_chapter(p_chapter uuid)
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
  if not public.story_active(ch.story_id) then
    raise exception 'story_finished';
  end if;
  if (select count(*) from public.chapters where story_id = ch.story_id) = 1 then
    raise exception 'last_chapter';
  end if;
  delete from public.chapters where id = p_chapter;
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
  if not public.story_active(p_story) then
    raise exception 'story_finished';
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

create or replace function public.create_invite_link(p_story uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
begin
  if public.story_role(p_story) is null or public.story_role(p_story) < 'cohost' then
    raise exception 'not_allowed';
  end if;
  if not public.story_active(p_story) then
    raise exception 'story_finished';
  end if;

  insert into public.invites (story_id, invited_by, token) values (p_story, (select auth.uid()), new_token);
  return new_token;
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
  if not public.story_active(inv.story_id) then
    raise exception 'story_finished';
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

-- No longer befriends the inviter.
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
  if not public.story_active(inv.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.story_members (story_id, user_id) values (inv.story_id, me);
  perform public.assign_story_color(inv.story_id, me);
  update public.invites set used_at = now(), used_by = me where id = inv.id;
  perform public.notify(public.story_member_ids(inv.story_id), 'writer_joined', inv.story_id);
  -- A Friend Invite to the same Story has nothing left to join.
  delete from public.notifications n
  using public.invites i
  where n.invite_id = i.id and i.story_id = inv.story_id and i.invitee_id = me;
  return inv.story_id;
end;
$$;

-- Pending Invites go when their creator stops being a Co-host or Host, or leaves.
create function public.revoke_orphaned_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.role < 'cohost' then
    delete from public.invites
    where story_id = old.story_id and invited_by = old.user_id and used_at is null;
  end if;
  return null;
end;
$$;

revoke execute on function public.story_active(uuid) from public, anon;
revoke execute on function public.revoke_orphaned_invites() from public, anon, authenticated;

create trigger revoke_orphaned_invites after update of role or delete on public.story_members
  for each row execute function public.revoke_orphaned_invites();
