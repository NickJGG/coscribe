-- A Writer's Author Color inside one Story. Null means "use my profile color"; a value is set only when
-- the profile color collides with another member's. Effective color: coalesce(story_members.author_color,
-- profiles.author_color).
alter table public.story_members
  add column author_color text check (author_color ~ '^#[0-9a-f]{6}$');

-- Must match AUTHOR_COLORS in apps/web/src/lib/profile-rules.ts, in the same (hue) order.
create function public.author_palette()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    '#d93f4c', '#e2621b', '#c99000', '#3f9b4f', '#12a594', '#0b8fd6',
    '#3e63dd', '#6e56cf', '#ab4aba', '#d6409f', '#8d6748', '#5b6672'
  ];
$$;

-- Mirrors nextFreeColor in apps/web/src/lib/profile-rules.ts.
create function public.next_free_color(p_taken text[], p_preferred text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  palette text[] := public.author_palette();
  n integer := array_length(palette, 1);
  start integer := coalesce(array_position(palette, p_preferred), 0);
  candidate text;
begin
  if not (p_preferred = any (p_taken)) then
    return p_preferred;
  end if;
  for i in 1..n loop
    candidate := palette[(start - 1 + i) % n + 1];
    if not (candidate = any (p_taken)) then
      return candidate;
    end if;
  end loop;
  return p_preferred;
end;
$$;

-- Effective colors of everyone in the Story except p_user.
create function public.story_colors_taken(p_story uuid, p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(coalesce(m.author_color, p.author_color)), '{}')
  from public.story_members m
  join public.profiles p on p.id = m.user_id
  where m.story_id = p_story and m.user_id <> p_user;
$$;

-- For a new member: existing members keep their colors, and the newcomer adapts.
create function public.assign_story_color(p_story uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  preferred text := (select author_color from public.profiles where id = p_user);
  pick text;
begin
  -- Two people joining at once must not both take the same free color.
  perform 1 from public.stories where id = p_story for update;
  pick := public.next_free_color(public.story_colors_taken(p_story, p_user), preferred);
  update public.story_members
  set author_color = nullif(pick, preferred)
  where story_id = p_story and user_id = p_user;
end;
$$;

create function public.set_story_color(p_story uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if public.story_role(p_story) is null then
    raise exception 'not_allowed';
  end if;
  if not (p_color = any (public.author_palette())) then
    raise exception 'not_a_color';
  end if;

  perform 1 from public.stories where id = p_story for update;
  if p_color = any (public.story_colors_taken(p_story, me)) then
    raise exception 'color_taken';
  end if;

  update public.story_members
  set author_color = nullif(p_color, (select author_color from public.profiles where id = me))
  where story_id = p_story and user_id = me;
end;
$$;

-- A new profile color applies in each Story where it's free. Where another member has it, the Writer
-- keeps the color they had there.
create function public.keep_story_colors()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.story_members m
  set author_color = case
    when new.author_color = any (public.story_colors_taken(m.story_id, m.user_id))
      then coalesce(m.author_color, old.author_color)
  end
  where m.user_id = new.id;
  return new;
end;
$$;

create trigger profiles_keep_story_colors
  after update of author_color on public.profiles
  for each row
  when (old.author_color is distinct from new.author_color)
  execute function public.keep_story_colors();

-- Settle collisions that predate Story colors, earliest member first.
do $$
declare
  m record;
begin
  for m in
    select sm.story_id, sm.user_id, sm.joined_at, p.author_color
    from public.story_members sm
    join public.profiles p on p.id = sm.user_id
    order by sm.story_id, sm.joined_at, sm.user_id
  loop
    update public.story_members
    set author_color = nullif(
      public.next_free_color(
        (
          select coalesce(array_agg(coalesce(e.author_color, ep.author_color)), '{}')
          from public.story_members e
          join public.profiles ep on ep.id = e.user_id
          where e.story_id = m.story_id and (e.joined_at, e.user_id) < (m.joined_at, m.user_id)
        ),
        m.author_color
      ),
      m.author_color
    )
    where story_id = m.story_id and user_id = m.user_id;
  end loop;
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
  end if;
  update public.invites set used_at = now(), used_by = inv.invitee_id where id = inv.id;
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
  return inv.story_id;
end;
$$;

revoke execute on function public.author_palette() from public, anon;
revoke execute on function public.next_free_color(text[], text) from public, anon;
revoke execute on function public.story_colors_taken(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.assign_story_color(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.keep_story_colors() from public, anon, authenticated;
revoke execute on function public.set_story_color(uuid, text) from public, anon;
