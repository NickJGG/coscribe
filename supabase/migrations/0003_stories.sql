-- Declared weakest first so roles compare with < and >=.
create type public.member_role as enum ('writer', 'cohost', 'host');
create type public.story_visibility as enum ('public', 'private');
create type public.story_status as enum ('active', 'finished');

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  visibility public.story_visibility not null default 'private',
  status public.story_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.story_members (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'writer',
  joined_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create unique index story_members_one_host_idx on public.story_members (story_id) where role = 'host';
create index story_members_user_idx on public.story_members (user_id);

-- Friend Invites carry invitee_id; Invite Links carry a token. used_at marks either as spent.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid references public.profiles (id) on delete cascade,
  token text unique,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  check ((invitee_id is null) <> (token is null))
);

create unique index invites_one_pending_per_friend_idx
  on public.invites (story_id, invitee_id)
  where invitee_id is not null and used_at is null;
create index invites_invitee_idx on public.invites (invitee_id) where used_at is null;

-- Helpers. Security definer so RLS policies can call them without recursing into story_members' own policies.

create function public.story_role(p_story uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.story_members
  where story_id = p_story and user_id = (select auth.uid());
$$;

-- Pending invitees can look before they accept.
create function public.can_view_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.stories
    where id = p_story
      and (visibility = 'public' or public.story_role(p_story) is not null)
  ) or exists (
    select 1 from public.invites
    where story_id = p_story and invitee_id = (select auth.uid()) and used_at is null
  );
$$;

-- RLS

alter table public.stories enable row level security;
alter table public.story_members enable row level security;
alter table public.invites enable row level security;

create policy "visible stories are readable"
  on public.stories for select
  to anon, authenticated
  using (public.can_view_story(id));

create policy "hosts update their story"
  on public.stories for update
  to authenticated
  using (public.story_role(id) = 'host')
  with check (public.story_role(id) = 'host');

create policy "hosts delete their story"
  on public.stories for delete
  to authenticated
  using (public.story_role(id) = 'host');

revoke update on public.stories from anon, authenticated;
grant update (title, visibility) on public.stories to authenticated;

create policy "members of visible stories are readable"
  on public.story_members for select
  to anon, authenticated
  using (public.can_view_story(story_id));

create policy "invitees and co-hosts see invites"
  on public.invites for select
  to authenticated
  using (invitee_id = (select auth.uid()) or public.story_role(story_id) >= 'cohost');

-- Covers declining (invitee) and revoking (Co-host and up).
create policy "invitees and co-hosts delete invites"
  on public.invites for delete
  to authenticated
  using (invitee_id = (select auth.uid()) or public.story_role(story_id) >= 'cohost');

-- RPCs for everything that has to check more than one row or change more than one row.

create function public.create_story(p_title text, p_visibility public.story_visibility)
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

  insert into public.stories (title, visibility) values (btrim(p_title), p_visibility)
  returning id into new_id;
  insert into public.story_members (story_id, user_id, role) values (new_id, (select auth.uid()), 'host');
  return new_id;
end;
$$;

create function public.set_member_role(p_story uuid, p_user uuid, p_role public.member_role)
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
  where story_id = p_story and user_id = p_user and role <> 'host';
  if not found then
    raise exception 'not_member';
  end if;
end;
$$;

create function public.remove_member(p_story uuid, p_user uuid)
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
end;
$$;

create function public.leave_story(p_story uuid)
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
end;
$$;

-- The old Host stays on as a Co-host.
create function public.transfer_host(p_story uuid, p_user uuid)
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
end;
$$;

create function public.invite_friend(p_story uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  on conflict do nothing;
end;
$$;

create function public.create_invite_link(p_story uuid)
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

  insert into public.invites (story_id, invited_by, token) values (p_story, (select auth.uid()), new_token);
  return new_token;
end;
$$;

create function public.accept_invite(p_invite uuid)
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
  update public.invites set used_at = now(), used_by = inv.invitee_id where id = inv.id;
  return inv.story_id;
end;
$$;

-- An existing member opening the link leaves it unspent, so it still works for the person it was meant for.
create function public.accept_invite_link(p_token text)
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
  update public.invites set used_at = now(), used_by = me where id = inv.id;
  perform public.befriend(inv.invited_by, me);
  return inv.story_id;
end;
$$;

-- Lets someone holding a link see what it's for before signing in, even for a Private story.
create function public.invite_link_preview(p_token text)
returns table (story_id uuid, story_title text, inviter_username text, used boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, p.username, i.used_at is not null
  from public.invites i
  join public.stories s on s.id = i.story_id
  join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.story_role(uuid) to anon;
grant execute on function public.can_view_story(uuid) to anon;
grant execute on function public.invite_link_preview(text) to anon;
