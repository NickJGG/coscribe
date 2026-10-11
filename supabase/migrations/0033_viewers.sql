-- Invited Viewers: a read-only member role for Private stories. They read what a Public Viewer reads
-- (Chapters, Story Bible), and nothing that's for Writers (Story Chat, Notes, Author Colors, Credits).
-- Wherever "member" meant Writer, it's now is_writer().

alter table public.invites
  add column role public.member_role not null default 'writer' check (role in ('writer', 'viewer'));

create function public.is_writer(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.story_role(p_story) >= 'writer', false);
$$;

create function public.story_writer_ids(p_story uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(user_id), '{}') from public.story_members
  where story_id = p_story and role >= 'writer';
$$;

create or replace function public.can_write_story(p_story uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_writer(p_story) and public.story_active(p_story);
$$;

drop policy "members read story chat" on public.chat_messages;
create policy "writers read story chat"
  on public.chat_messages for select
  to authenticated
  using (public.is_writer(story_id));

drop policy "members post to story chat" on public.chat_messages;
create policy "writers post to story chat"
  on public.chat_messages for insert
  to authenticated
  with check (public.is_writer(story_id) and user_id = (select auth.uid()));

drop policy "members read notes" on public.notes;
create policy "writers read notes"
  on public.notes for select
  to authenticated
  using (public.is_writer(story_id));

drop policy "members read note replies" on public.note_replies;
create policy "writers read note replies"
  on public.note_replies for select
  to authenticated
  using (public.is_writer(story_id));

create or replace function public.writer_mention_ids(p_body text, p_story uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct m.g[1]::uuid), '{}')
  from regexp_matches(
    coalesce(p_body, ''),
    '@\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]',
    'g'
  ) as m(g)
  where m.g[1]::uuid = any (public.story_writer_ids(p_story));
$$;

create or replace function public.add_note(p_id uuid, p_chapter uuid, p_quote text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ch record;
begin
  select story_id, locked, title into ch from public.chapters where id = p_chapter;
  if not found or not public.is_writer(ch.story_id) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(ch.story_id) then
    raise exception 'story_finished';
  end if;
  if ch.locked then
    raise exception 'chapter_locked';
  end if;

  insert into public.notes (id, story_id, chapter_id, author_id, quote, body)
  values (p_id, ch.story_id, p_chapter, (select auth.uid()), left(btrim(p_quote), 300), btrim(p_body));

  perform public.notify(
    public.writer_mention_ids(p_body, ch.story_id),
    'note_mention',
    ch.story_id,
    jsonb_build_object(
      'chapter_id', p_chapter,
      'chapter_title', ch.title,
      'excerpt', left(public.writer_mention_text(btrim(p_body)), 140)
    ),
    null,
    p_id
  );
end;
$$;

create or replace function public.reply_note(p_note uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
  new_id uuid;
  mentioned uuid[];
  detail jsonb;
begin
  select id, story_id, chapter_id, author_id, body into n from public.notes where id = p_note;
  if not found or not public.is_writer(n.story_id) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  insert into public.note_replies (note_id, story_id, chapter_id, author_id, body)
  values (n.id, n.story_id, n.chapter_id, (select auth.uid()), btrim(p_body))
  returning id into new_id;

  mentioned := public.writer_mention_ids(p_body, n.story_id);
  detail := jsonb_build_object(
    'chapter_id', n.chapter_id,
    'chapter_title', (select title from public.chapters where id = n.chapter_id),
    'excerpt', left(public.writer_mention_text(btrim(p_body)), 140)
  );

  perform public.notify(mentioned, 'note_mention', n.story_id, detail, null, n.id);
  perform public.notify(
    array(
      select distinct p.id
      from (
        select n.author_id as id
        union select author_id from public.note_replies where note_id = n.id
        union select unnest(public.writer_mention_ids(n.body, n.story_id))
        union select unnest(public.writer_mention_ids(r.body, n.story_id)) from public.note_replies r where r.note_id = n.id
      ) p
      where p.id = any (public.story_writer_ids(n.story_id)) and not (p.id = any (mentioned))
    ),
    'note_reply',
    n.story_id,
    detail,
    null,
    n.id
  );
  return new_id;
end;
$$;

create or replace function public.set_note_resolved(p_note uuid, p_resolved boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
begin
  select id, story_id, chapter_id, author_id, quote into n from public.notes where id = p_note;
  if not found or not public.is_writer(n.story_id) then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  update public.notes
  set resolved_at = case when p_resolved then now() end,
      resolved_by = case when p_resolved then (select auth.uid()) end
  where id = n.id and (resolved_at is not null) is distinct from p_resolved;
  if found and p_resolved and n.author_id = any (public.story_writer_ids(n.story_id)) then
    perform public.notify(
      array[n.author_id],
      'note_resolved',
      n.story_id,
      jsonb_build_object(
        'chapter_id', n.chapter_id,
        'chapter_title', (select title from public.chapters where id = n.chapter_id),
        'excerpt', left(n.quote, 140)
      ),
      null,
      n.id
    );
  end if;
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
  if not public.is_writer(p_story) then
    raise exception 'not_allowed';
  end if;
  if not public.story_active(p_story) then
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

-- Viewers have no Author Color, so they never take one from a Writer.
create or replace function public.story_colors_taken(p_story uuid, p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(coalesce(m.author_color, p.author_color)), '{}')
  from public.story_members m
  join public.profiles p on p.id = m.user_id
  where m.story_id = p_story and m.user_id <> p_user and m.role >= 'writer';
$$;

create or replace function public.set_story_color(p_story uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.is_writer(p_story) then
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

-- Writer <-> Viewer is open to Co-hosts too, on Private stories only. Anything involving Co-host stays
-- with the Host, and a Viewer goes through Writer first.
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

  update public.story_members set role = p_role where story_id = p_story and user_id = p_user;
  if target = 'viewer' then
    perform public.assign_story_color(p_story, p_user);
  end if;
  perform public.notify(array[p_user], 'role_changed', p_story, jsonb_build_object('role', p_role));
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
  where story_id = p_story and user_id = p_user and role >= 'writer';
  if not found then
    raise exception 'not_member';
  end if;
  perform public.notify(array[p_user], 'role_changed', p_story, jsonb_build_object('role', 'host'));
end;
$$;

-- New signatures with a defaulted role; the old ones go so calls without p_role aren't ambiguous.
drop function public.invite_friend(uuid, uuid);
drop function public.create_invite_link(uuid);

-- Viewer Invites are for Private stories only. Finished blocks only Writer Invites.
create function public.invite_friend(p_story uuid, p_user uuid, p_role public.member_role default 'writer')
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

create function public.create_invite_link(p_story uuid, p_role public.member_role default 'writer')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
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

  insert into public.invites (story_id, invited_by, token, role)
  values (p_story, (select auth.uid()), new_token, p_role);
  return new_token;
end;
$$;

-- Nobody hears about a Viewer joining.
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
  if inv.role = 'writer' and not public.story_active(inv.story_id) then
    raise exception 'story_finished';
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
  if inv.role = 'writer' and not public.story_active(inv.story_id) then
    raise exception 'story_finished';
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

drop function public.invite_link_preview(text);

-- Lets someone holding a link see what it's for before signing in, even for a Private story.
create function public.invite_link_preview(p_token text)
returns table (story_id uuid, story_title text, inviter_username text, used boolean, role public.member_role)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, p.username, i.used_at is not null, i.role
  from public.invites i
  join public.stories s on s.id = i.story_id
  join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

create or replace function public.finished_public_stories()
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
    (select count(*)::integer from public.story_members m where m.story_id = s.id and m.role >= 'writer'),
    (select count(*)::integer from public.chapters c where c.story_id = s.id)
  from public.stories s
  where s.visibility = 'public'
    and not s.hidden_from_front
    and s.status = 'finished'
  order by s.finished_at desc nulls last
  limit 3;
$$;

revoke execute on function public.is_writer(uuid) from public, anon;
revoke execute on function public.story_writer_ids(uuid) from public, anon, authenticated;
revoke execute on function public.invite_friend(uuid, uuid, public.member_role) from public, anon;
revoke execute on function public.create_invite_link(uuid, public.member_role) from public, anon;
revoke execute on function public.invite_link_preview(text) from public;
grant execute on function public.invite_link_preview(text) to anon, authenticated;
