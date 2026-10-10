


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."entry_type" AS ENUM (
    'character',
    'place',
    'item',
    'lore'
);


ALTER TYPE "public"."entry_type" OWNER TO "postgres";


CREATE TYPE "public"."friendship_status" AS ENUM (
    'pending',
    'accepted'
);


ALTER TYPE "public"."friendship_status" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'writer',
    'cohost',
    'host'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."notification_kind" AS ENUM (
    'invite_received',
    'writer_joined',
    'chapter_added',
    'story_finished',
    'story_deleted',
    'removed',
    'role_changed',
    'note_reply',
    'note_resolved',
    'note_mention',
    'chat_mention'
);


ALTER TYPE "public"."notification_kind" OWNER TO "postgres";


CREATE TYPE "public"."story_status" AS ENUM (
    'active',
    'finished'
);


ALTER TYPE "public"."story_status" OWNER TO "postgres";


CREATE TYPE "public"."story_visibility" AS ENUM (
    'public',
    'private'
);


ALTER TYPE "public"."story_visibility" OWNER TO "postgres";


CREATE TYPE "public"."theme" AS ENUM (
    'light',
    'dark',
    'system'
);


ALTER TYPE "public"."theme" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite"("p_invite" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."accept_invite"("p_invite" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invite_link"("p_token" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."accept_invite_link"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_chapter"("p_story" "uuid", "p_title" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."add_chapter"("p_story" "uuid", "p_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_note"("p_id" "uuid", "p_chapter" "uuid", "p_quote" "text", "p_body" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  ch record;
begin
  select story_id, locked, title into ch from public.chapters where id = p_chapter;
  if not found or public.story_role(ch.story_id) is null then
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


ALTER FUNCTION "public"."add_note"("p_id" "uuid", "p_chapter" "uuid", "p_quote" "text", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."are_friends"("a" "uuid", "b" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;


ALTER FUNCTION "public"."are_friends"("a" "uuid", "b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_story_color"("p_story" "uuid", "p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."assign_story_color"("p_story" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."author_palette"() RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select array[
    '#d93f4c', '#e2621b', '#c99000', '#3f9b4f', '#12a594', '#0b8fd6',
    '#3e63dd', '#6e56cf', '#ab4aba', '#d6409f', '#8d6748', '#5b6672'
  ];
$$;


ALTER FUNCTION "public"."author_palette"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authorize_restore"("p_snapshot" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  story uuid;
begin
  select c.story_id into story
  from public.chapter_snapshots s
  join public.chapters c on c.id = s.chapter_id
  where s.id = p_snapshot;

  if story is null or public.story_role(story) is null or public.story_role(story) < 'cohost' then
    raise exception 'not_allowed';
  end if;
  if (select status from public.stories where id = story) = 'finished' then
    raise exception 'story_finished';
  end if;
  return story;
end;
$$;


ALTER FUNCTION "public"."authorize_restore"("p_snapshot" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."authorize_snapshot"("p_chapter" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  story uuid;
begin
  story := public.chapter_story(p_chapter);

  if story is null or public.story_role(story) is null or public.story_role(story) < 'cohost' then
    raise exception 'not_allowed';
  end if;
  if (select status from public.stories where id = story) = 'finished' then
    raise exception 'story_finished';
  end if;
  return story;
end;
$$;


ALTER FUNCTION "public"."authorize_snapshot"("p_chapter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."befriend"("a" "uuid", "b" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  insert into public.friendships (requester_id, addressee_id, status)
  values (a, b, 'accepted')
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  do update set status = 'accepted';
$$;


ALTER FUNCTION "public"."befriend"("a" "uuid", "b" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_story"("p_story" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.stories
    where id = p_story
      and (visibility = 'public' or public.story_role(p_story) is not null)
  ) or exists (
    select 1 from public.invites
    where story_id = p_story and invitee_id = (select auth.uid()) and used_at is null
  );
$$;


ALTER FUNCTION "public"."can_view_story"("p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_write_story"("p_story" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.story_role(p_story) is not null
    and exists (select 1 from public.stories where id = p_story and status = 'active');
$$;


ALTER FUNCTION "public"."can_write_story"("p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."chapter_story"("p_chapter" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select story_id from public.chapters where id = p_chapter;
$$;


ALTER FUNCTION "public"."chapter_story"("p_chapter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invite_link"("p_story" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."create_invite_link"("p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_story"("p_title" "text", "p_visibility" "public"."story_visibility", "p_blurb" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in';
  end if;

  insert into public.stories (title, visibility, blurb)
  values (btrim(p_title), p_visibility, nullif(btrim(p_blurb), ''))
  returning id into new_id;
  insert into public.story_members (story_id, user_id, role) values (new_id, (select auth.uid()), 'host');
  insert into public.chapters (story_id, position, title) values (new_id, 1, 'Chapter 1');
  return new_id;
end;
$$;


ALTER FUNCTION "public"."create_story"("p_title" "text", "p_visibility" "public"."story_visibility", "p_blurb" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_chapter"("p_chapter" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  ch public.chapters;
begin
  select * into ch from public.chapters where id = p_chapter;
  if not found or public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  perform 1 from public.stories where id = ch.story_id for update;
  if (select count(*) from public.chapters where story_id = ch.story_id) = 1 then
    raise exception 'last_chapter';
  end if;
  delete from public.chapters where id = p_chapter;
end;
$$;


ALTER FUNCTION "public"."delete_chapter"("p_chapter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_story"("p_story" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.story_role(p_story) is distinct from 'host' then
    raise exception 'not_allowed';
  end if;

  perform public.notify(public.story_member_ids(p_story), 'story_deleted', p_story);
  delete from public.stories where id = p_story;
end;
$$;


ALTER FUNCTION "public"."delete_story"("p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finished_public_stories"() RETURNS TABLE("id" "uuid", "title" "text", "blurb" "text", "writers" integer, "chapters" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    s.id,
    s.title,
    s.blurb,
    (select count(*)::integer from public.story_members m where m.story_id = s.id),
    (select count(*)::integer from public.chapters c where c.story_id = s.id)
  from public.stories s
  where s.visibility = 'public'
    and not s.hidden_from_front
    and s.status = 'finished'
  order by s.finished_at desc nulls last
  limit 3;
$$;


ALTER FUNCTION "public"."finished_public_stories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."forget_story_notifications"("p_story" "uuid", "p_user" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  delete from public.notifications
  where story_id = p_story and recipient_id = p_user and kind <> 'removed';
$$;


ALTER FUNCTION "public"."forget_story_notifications"("p_story" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."friends_presence"() RETURNS TABLE("user_id" "uuid", "username" "text", "author_color" "text", "story_id" "uuid", "story_title" "text", "chapter_id" "uuid", "chapter_title" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p.id, p.username, p.author_color, w.story_id, w.story_title, w.chapter_id, w.chapter_title
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  left join lateral (
    select sp.story_id, s.title as story_title, c.id as chapter_id, c.title as chapter_title
    from public.story_presence sp
    join public.stories s on s.id = sp.story_id
    left join public.chapters c on c.id = sp.document_id and sp.kind = 'chapter'
    where sp.user_id = p.id and public.can_view_story(sp.story_id)
    order by sp.connected_at desc
    limit 1
  ) w on true
  where f.status = 'accepted'
    and (select auth.uid()) in (f.requester_id, f.addressee_id)
    and p.show_online
    and p.last_seen > now() - interval '2 minutes'
  order by p.username;
$$;


ALTER FUNCTION "public"."friends_presence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."heartbeat"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.profiles set last_seen = now() where id = (select auth.uid());
$$;


ALTER FUNCTION "public"."heartbeat"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_friend"("p_story" "uuid", "p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."invite_friend"("p_story" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_link_preview"("p_token" "text") RETURNS TABLE("story_id" "uuid", "story_title" "text", "inviter_username" "text", "used" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select s.id, s.title, p.username, i.used_at is not null
  from public.invites i
  join public.stories s on s.id = i.story_id
  join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;


ALTER FUNCTION "public"."invite_link_preview"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."keep_story_colors"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."keep_story_colors"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_story"("p_story" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.story_role(p_story) = 'host' then
    raise exception 'host_cannot_leave';
  end if;
  delete from public.story_members where story_id = p_story and user_id = (select auth.uid());
  perform public.forget_story_notifications(p_story, (select auth.uid()));
end;
$$;


ALTER FUNCTION "public"."leave_story"("p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."live_public_stories"() RETURNS TABLE("id" "uuid", "title" "text", "blurb" "text", "writers" integer, "viewers" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select s.id, s.title, s.blurb, a.writers, a.viewers
  from public.stories s
  join public.story_activity a on a.story_id = s.id
  where s.visibility = 'public'
    and not s.hidden_from_front
    and a.writers > 0
    and (select coalesce(sum(c.word_count), 0) from public.chapters c where c.story_id = s.id) >= 200
  order by a.writers desc, a.viewers desc, s.created_at desc
  limit 3;
$$;


ALTER FUNCTION "public"."live_public_stories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.notifications set read_at = now()
  where id = p_id and recipient_id = (select auth.uid()) and read_at is null;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notifications_read"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.notifications set read_at = now()
  where recipient_id = (select auth.uid()) and read_at is null;
$$;


ALTER FUNCTION "public"."mark_notifications_read"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_chapter_to"("p_chapter" "uuid", "p_after" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  ch public.chapters;
  ids uuid[];
  k integer;
begin
  select * into ch from public.chapters where id = p_chapter;
  if not found or public.story_role(ch.story_id) is null or public.story_role(ch.story_id) < 'cohost' then
    raise exception 'not_allowed';
  end if;

  if (select status from public.stories where id = ch.story_id for update) = 'finished' then
    raise exception 'story_finished';
  end if;
  if p_after = p_chapter then
    return;
  end if;
  if p_after is not null
    and not exists (select 1 from public.chapters where id = p_after and story_id = ch.story_id) then
    raise exception 'chapter_list_changed';
  end if;

  ids := array(
    select id from public.chapters where story_id = ch.story_id and id <> p_chapter order by position
  );
  k := coalesce(array_position(ids, p_after), 0);
  ids := ids[1:k] || p_chapter || ids[k + 1:];

  -- Also closes gaps left by delete_chapter.
  update public.chapters c
  set position = o.ord
  from unnest(ids) with ordinality o(id, ord)
  where c.id = o.id and c.position is distinct from o.ord;
end;
$$;


ALTER FUNCTION "public"."move_chapter_to"("p_chapter" "uuid", "p_after" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_free_color"("p_taken" "text"[], "p_preferred" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."next_free_color"("p_taken" "text"[], "p_preferred" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify"("p_recipients" "uuid"[], "p_kind" "public"."notification_kind", "p_story" "uuid", "p_detail" "jsonb" DEFAULT '{}'::"jsonb", "p_invite" "uuid" DEFAULT NULL::"uuid", "p_note" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  insert into public.notifications (recipient_id, actor_id, kind, story_id, story_title, invite_id, note_id, detail)
  select r, (select auth.uid()), p_kind, s.id, s.title, p_invite, p_note, coalesce(p_detail, '{}')
  from unnest(p_recipients) r
  join public.stories s on s.id = p_story
  where r is distinct from (select auth.uid())
    and not (
      p_kind in ('writer_joined', 'chapter_added')
      and exists (
        select 1 from public.story_members m
        where m.story_id = p_story and m.user_id = r and m.notify = 'mine'
      )
    );
$$;


ALTER FUNCTION "public"."notify"("p_recipients" "uuid"[], "p_kind" "public"."notification_kind", "p_story" "uuid", "p_detail" "jsonb", "p_invite" "uuid", "p_note" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_added_writer_mentions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  added uuid[];
  note uuid;
begin
  added := array(
    select unnest(public.writer_mention_ids(new.body, new.story_id))
    except
    select unnest(public.writer_mention_ids(old.body, new.story_id))
  );
  if cardinality(added) = 0 then
    return null;
  end if;

  -- Separate statements: plpgsql would reject new.note_id on notes even in an untaken branch of one expression.
  if tg_table_name = 'notes' then
    note := new.id;
  else
    note := new.note_id;
  end if;

  perform public.notify(
    added,
    'note_mention',
    new.story_id,
    jsonb_build_object(
      'chapter_id', new.chapter_id,
      'chapter_title', (select title from public.chapters where id = new.chapter_id),
      'excerpt', left(public.writer_mention_text(new.body), 140)
    ),
    null,
    note
  );
  return null;
end;
$$;


ALTER FUNCTION "public"."notify_added_writer_mentions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_chat_writer_mentions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.can_write_story(new.story_id) then
    return null;
  end if;

  perform public.notify(
    public.writer_mention_ids(new.body, new.story_id),
    'chat_mention',
    new.story_id,
    jsonb_build_object('message_id', new.id, 'excerpt', left(public.writer_mention_text(new.body), 140))
  );
  return null;
end;
$$;


ALTER FUNCTION "public"."notify_chat_writer_mentions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_stories"() RETURNS TABLE("id" "uuid", "title" "text", "blurb" "text", "status" "public"."story_status", "writers" integer, "viewers" integer, "edited_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select s.id, s.title, s.blurb, s.status, coalesce(a.writers, 0), coalesce(a.viewers, 0), e.edited_at
  from public.stories s
  left join public.story_activity a on a.story_id = s.id
  left join lateral (
    select max(c.edited_at) as edited_at from public.chapters c where c.story_id = s.id
  ) e on true
  where s.visibility = 'public' and not s.hidden_from_front
  order by coalesce(a.writers, 0) > 0 desc, e.edited_at desc nulls last, s.created_at desc
  limit 50;
$$;


ALTER FUNCTION "public"."public_stories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_member"("p_story" "uuid", "p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."remove_member"("p_story" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reply_note"("p_note" "uuid", "p_body" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  n record;
  new_id uuid;
  mentioned uuid[];
  detail jsonb;
begin
  select id, story_id, chapter_id, author_id, body into n from public.notes where id = p_note;
  if not found or public.story_role(n.story_id) is null then
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
      where p.id = any (public.story_member_ids(n.story_id)) and not (p.id = any (mentioned))
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


ALTER FUNCTION "public"."reply_note"("p_note" "uuid", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_edited_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.edited_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_edited_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_member_role"("p_story" "uuid", "p_user" "uuid", "p_role" "public"."member_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."set_member_role"("p_story" "uuid", "p_user" "uuid", "p_role" "public"."member_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_note_resolved"("p_note" "uuid", "p_resolved" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  n record;
begin
  select id, story_id, chapter_id, author_id, quote into n from public.notes where id = p_note;
  if not found or public.story_role(n.story_id) is null then
    raise exception 'not_allowed';
  end if;
  if not public.can_write_story(n.story_id) then
    raise exception 'story_finished';
  end if;

  update public.notes
  set resolved_at = case when p_resolved then now() end,
      resolved_by = case when p_resolved then (select auth.uid()) end
  where id = n.id and (resolved_at is not null) is distinct from p_resolved;
  if found and p_resolved and n.author_id = any (public.story_member_ids(n.story_id)) then
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


ALTER FUNCTION "public"."set_note_resolved"("p_note" "uuid", "p_resolved" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_story_color"("p_story" "uuid", "p_color" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."set_story_color"("p_story" "uuid", "p_color" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_story_finished"("p_story" "uuid", "p_finished" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."set_story_finished"("p_story" "uuid", "p_finished" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_story_notify"("p_story" "uuid", "p_notify" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if public.story_role(p_story) is null then
    raise exception 'not_allowed';
  end if;
  if p_notify is null or p_notify not in ('all', 'mine') then
    raise exception 'not_a_choice';
  end if;

  update public.story_members set notify = p_notify
  where story_id = p_story and user_id = (select auth.uid());
end;
$$;


ALTER FUNCTION "public"."set_story_notify"("p_story" "uuid", "p_notify" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."story_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  -- Through jsonb because plpgsql rejects new.story_id on stories even in an untaken branch.
  changed uuid := coalesce(to_jsonb(new), to_jsonb(old))
    ->> case when tg_table_name = 'stories' then 'id' else 'story_id' end;
begin
  insert into public.story_changes (story_id)
  select changed where exists (select 1 from public.stories where id = changed)
  on conflict (story_id) do update set changed_at = now();
  return null;
end;
$$;


ALTER FUNCTION "public"."story_changed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."story_colors_taken"("p_story" "uuid", "p_user" "uuid") RETURNS "text"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(array_agg(coalesce(m.author_color, p.author_color)), '{}')
  from public.story_members m
  join public.profiles p on p.id = m.user_id
  where m.story_id = p_story and m.user_id <> p_user;
$$;


ALTER FUNCTION "public"."story_colors_taken"("p_story" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."story_member_ids"("p_story" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(array_agg(user_id), '{}') from public.story_members where story_id = p_story;
$$;


ALTER FUNCTION "public"."story_member_ids"("p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."story_role"("p_story" "uuid") RETURNS "public"."member_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select role from public.story_members
  where story_id = p_story and user_id = (select auth.uid());
$$;


ALTER FUNCTION "public"."story_role"("p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_host"("p_story" "uuid", "p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."transfer_host"("p_story" "uuid", "p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."writer_mention_ids"("p_body" "text", "p_story" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select coalesce(array_agg(distinct m.g[1]::uuid), '{}')
  from regexp_matches(
    coalesce(p_body, ''),
    '@\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]',
    'g'
  ) as m(g)
  where m.g[1]::uuid = any (public.story_member_ids(p_story));
$$;


ALTER FUNCTION "public"."writer_mention_ids"("p_body" "text", "p_story" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."writer_mention_text"("p_body" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  result text := p_body;
  token text;
begin
  for token in
    select distinct m.g[1]
    from regexp_matches(
      coalesce(p_body, ''),
      '@\[([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]',
      'g'
    ) as m(g)
  loop
    result := replace(
      result,
      '@[' || token || ']',
      '@' || coalesce((select username from public.profiles where id = token::uuid), 'someone')
    );
  end loop;
  return result;
end;
$$;


ALTER FUNCTION "public"."writer_mention_text"("p_body" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."chapter_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "taken_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "state" "bytea" NOT NULL,
    "content_hash" "text" NOT NULL,
    CONSTRAINT "chapter_snapshots_name_check" CHECK ((("name" IS NULL) OR (("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 80))))
);


ALTER TABLE "public"."chapter_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "title" "text" NOT NULL,
    "locked" boolean DEFAULT false NOT NULL,
    "ydoc" "bytea",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "word_count" integer DEFAULT 0 NOT NULL,
    "author_chars" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "edited_at" timestamp with time zone,
    CONSTRAINT "chapters_title_check" CHECK ((("char_length"("btrim"("title")) >= 1) AND ("char_length"("btrim"("title")) <= 120)))
);


ALTER TABLE "public"."chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_messages_body_check" CHECK ((("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 2000)))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "type" "public"."entry_type" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "ydoc" "bytea",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aliases" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "link_entry_mentions" boolean DEFAULT true NOT NULL,
    CONSTRAINT "entries_aliases_check" CHECK (("cardinality"("aliases") <= 20)),
    CONSTRAINT "entries_description_check" CHECK (("char_length"("description") <= 280)),
    CONSTRAINT "entries_name_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 80)))
);


ALTER TABLE "public"."entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "requester_id" "uuid" NOT NULL,
    "addressee_id" "uuid" NOT NULL,
    "status" "public"."friendship_status" DEFAULT 'pending'::"public"."friendship_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "friendships_check" CHECK (("requester_id" <> "addressee_id"))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "story_id" "uuid" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invitee_id" "uuid",
    "token" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    CONSTRAINT "invites_check" CHECK ((("invitee_id" IS NULL) <> ("token" IS NULL)))
);


ALTER TABLE "public"."invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."note_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note_id" "uuid" NOT NULL,
    "story_id" "uuid" NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "edited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "note_replies_body_check" CHECK ((("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 2000)))
);


ALTER TABLE "public"."note_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" NOT NULL,
    "story_id" "uuid" NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "quote" "text" NOT NULL,
    "body" "text" NOT NULL,
    "edited_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notes_body_check" CHECK ((("char_length"("btrim"("body")) >= 1) AND ("char_length"("btrim"("body")) <= 2000))),
    CONSTRAINT "notes_quote_check" CHECK ((("char_length"("quote") >= 1) AND ("char_length"("quote") <= 300)))
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "kind" "public"."notification_kind" NOT NULL,
    "story_id" "uuid",
    "story_title" "text" NOT NULL,
    "invite_id" "uuid",
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "note_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "author_color" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "theme" "public"."theme" DEFAULT 'system'::"public"."theme" NOT NULL,
    "last_seen" timestamp with time zone,
    "show_online" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profiles_author_color_check" CHECK (("author_color" ~ '^#[0-9a-f]{6}$'::"text")),
    CONSTRAINT "profiles_username_check" CHECK (("username" ~ '^[a-z0-9_]{3,20}$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "visibility" "public"."story_visibility" DEFAULT 'private'::"public"."story_visibility" NOT NULL,
    "status" "public"."story_status" DEFAULT 'active'::"public"."story_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "hidden_from_front" boolean DEFAULT false NOT NULL,
    "blurb" "text",
    CONSTRAINT "stories_blurb_check" CHECK ((("blurb" IS NULL) OR (("char_length"("blurb") >= 1) AND ("char_length"("blurb") <= 280)))),
    CONSTRAINT "stories_title_check" CHECK ((("char_length"("btrim"("title")) >= 1) AND ("char_length"("btrim"("title")) <= 120)))
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_activity" (
    "story_id" "uuid" NOT NULL,
    "writers" integer DEFAULT 0 NOT NULL,
    "viewers" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_changes" (
    "story_id" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."story_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_members" (
    "story_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" DEFAULT 'writer'::"public"."member_role" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "author_color" "text",
    "notify" "text" DEFAULT 'all'::"text" NOT NULL,
    CONSTRAINT "story_members_author_color_check" CHECK (("author_color" ~ '^#[0-9a-f]{6}$'::"text")),
    CONSTRAINT "story_members_notify_check" CHECK (("notify" = ANY (ARRAY['all'::"text", 'mine'::"text"])))
);


ALTER TABLE "public"."story_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."story_presence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "story_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "connected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "story_presence_kind_check" CHECK (("kind" = ANY (ARRAY['chapter'::"text", 'entry'::"text"])))
);


ALTER TABLE "public"."story_presence" OWNER TO "postgres";


ALTER TABLE ONLY "public"."chapter_snapshots"
    ADD CONSTRAINT "chapter_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_story_id_position_key" UNIQUE ("story_id", "position") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("requester_id", "addressee_id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."note_replies"
    ADD CONSTRAINT "note_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_activity"
    ADD CONSTRAINT "story_activity_pkey" PRIMARY KEY ("story_id");



ALTER TABLE ONLY "public"."story_changes"
    ADD CONSTRAINT "story_changes_pkey" PRIMARY KEY ("story_id");



ALTER TABLE ONLY "public"."story_members"
    ADD CONSTRAINT "story_members_pkey" PRIMARY KEY ("story_id", "user_id");



ALTER TABLE ONLY "public"."story_presence"
    ADD CONSTRAINT "story_presence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."story_presence"
    ADD CONSTRAINT "story_presence_user_id_document_id_key" UNIQUE ("user_id", "document_id");



CREATE INDEX "chapter_snapshots_chapter_idx" ON "public"."chapter_snapshots" USING "btree" ("chapter_id", "taken_at" DESC);



CREATE INDEX "chat_messages_story_idx" ON "public"."chat_messages" USING "btree" ("story_id", "created_at" DESC);



CREATE INDEX "entries_story_idx" ON "public"."entries" USING "btree" ("story_id");



CREATE INDEX "friendships_addressee_idx" ON "public"."friendships" USING "btree" ("addressee_id");



CREATE UNIQUE INDEX "friendships_pair_idx" ON "public"."friendships" USING "btree" (LEAST("requester_id", "addressee_id"), GREATEST("requester_id", "addressee_id"));



CREATE INDEX "invites_invitee_idx" ON "public"."invites" USING "btree" ("invitee_id") WHERE ("used_at" IS NULL);



CREATE UNIQUE INDEX "invites_one_pending_per_friend_idx" ON "public"."invites" USING "btree" ("story_id", "invitee_id") WHERE (("invitee_id" IS NOT NULL) AND ("used_at" IS NULL));



CREATE INDEX "note_replies_chapter_idx" ON "public"."note_replies" USING "btree" ("chapter_id");



CREATE INDEX "note_replies_note_idx" ON "public"."note_replies" USING "btree" ("note_id", "created_at");



CREATE INDEX "notes_chapter_idx" ON "public"."notes" USING "btree" ("chapter_id", "created_at");



CREATE INDEX "notes_story_idx" ON "public"."notes" USING "btree" ("story_id") WHERE ("resolved_at" IS NULL);



CREATE INDEX "notifications_invite_idx" ON "public"."notifications" USING "btree" ("invite_id") WHERE ("invite_id" IS NOT NULL);



CREATE INDEX "notifications_note_idx" ON "public"."notifications" USING "btree" ("note_id") WHERE ("note_id" IS NOT NULL);



CREATE INDEX "notifications_recipient_idx" ON "public"."notifications" USING "btree" ("recipient_id", "created_at" DESC);



CREATE INDEX "notifications_story_idx" ON "public"."notifications" USING "btree" ("story_id", "recipient_id");



CREATE INDEX "notifications_unread_idx" ON "public"."notifications" USING "btree" ("recipient_id") WHERE ("read_at" IS NULL);



CREATE UNIQUE INDEX "story_members_one_host_idx" ON "public"."story_members" USING "btree" ("story_id") WHERE ("role" = 'host'::"public"."member_role");



CREATE INDEX "story_members_user_idx" ON "public"."story_members" USING "btree" ("user_id");



CREATE INDEX "story_presence_story_idx" ON "public"."story_presence" USING "btree" ("story_id");



CREATE OR REPLACE TRIGGER "notify_added_writer_mentions" AFTER UPDATE OF "body" ON "public"."note_replies" FOR EACH ROW WHEN (("old"."body" IS DISTINCT FROM "new"."body")) EXECUTE FUNCTION "public"."notify_added_writer_mentions"();



CREATE OR REPLACE TRIGGER "notify_added_writer_mentions" AFTER UPDATE OF "body" ON "public"."notes" FOR EACH ROW WHEN (("old"."body" IS DISTINCT FROM "new"."body")) EXECUTE FUNCTION "public"."notify_added_writer_mentions"();



CREATE OR REPLACE TRIGGER "notify_chat_writer_mentions" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_chat_writer_mentions"();



CREATE OR REPLACE TRIGGER "profiles_keep_story_colors" AFTER UPDATE OF "author_color" ON "public"."profiles" FOR EACH ROW WHEN (("old"."author_color" IS DISTINCT FROM "new"."author_color")) EXECUTE FUNCTION "public"."keep_story_colors"();



CREATE OR REPLACE TRIGGER "set_edited_at" BEFORE UPDATE OF "body" ON "public"."note_replies" FOR EACH ROW WHEN (("old"."body" IS DISTINCT FROM "new"."body")) EXECUTE FUNCTION "public"."set_edited_at"();



CREATE OR REPLACE TRIGGER "set_edited_at" BEFORE UPDATE OF "body" ON "public"."notes" FOR EACH ROW WHEN (("old"."body" IS DISTINCT FROM "new"."body")) EXECUTE FUNCTION "public"."set_edited_at"();



CREATE OR REPLACE TRIGGER "story_changed" AFTER INSERT OR DELETE OR UPDATE OF "title", "position", "locked" ON "public"."chapters" FOR EACH ROW EXECUTE FUNCTION "public"."story_changed"();



CREATE OR REPLACE TRIGGER "story_changed" AFTER INSERT OR DELETE OR UPDATE OF "type", "name", "description", "aliases", "link_entry_mentions" ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."story_changed"();



CREATE OR REPLACE TRIGGER "story_changed" AFTER INSERT OR DELETE OR UPDATE OF "resolved_at" ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."story_changed"();



CREATE OR REPLACE TRIGGER "story_changed" AFTER UPDATE OF "title", "visibility", "status", "blurb" ON "public"."stories" FOR EACH ROW EXECUTE FUNCTION "public"."story_changed"();



CREATE OR REPLACE TRIGGER "story_changed" AFTER INSERT OR DELETE OR UPDATE OF "role", "author_color" ON "public"."story_members" FOR EACH ROW EXECUTE FUNCTION "public"."story_changed"();



ALTER TABLE ONLY "public"."chapter_snapshots"
    ADD CONSTRAINT "chapter_snapshots_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invites"
    ADD CONSTRAINT "invites_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."note_replies"
    ADD CONSTRAINT "note_replies_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."note_replies"
    ADD CONSTRAINT "note_replies_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_replies"
    ADD CONSTRAINT "note_replies_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."note_replies"
    ADD CONSTRAINT "note_replies_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_activity"
    ADD CONSTRAINT "story_activity_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_members"
    ADD CONSTRAINT "story_members_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_members"
    ADD CONSTRAINT "story_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_presence"
    ADD CONSTRAINT "story_presence_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."story_presence"
    ADD CONSTRAINT "story_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "activity of visible stories is readable" ON "public"."story_activity" FOR SELECT TO "authenticated", "anon" USING ("public"."can_view_story"("story_id"));



CREATE POLICY "addressees accept requests" ON "public"."friendships" FOR UPDATE TO "authenticated" USING ((("addressee_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"public"."friendship_status"))) WITH CHECK (("status" = 'accepted'::"public"."friendship_status"));



CREATE POLICY "authors and co-hosts delete note replies" ON "public"."note_replies" FOR DELETE TO "authenticated" USING (((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."story_role"("story_id") >= 'cohost'::"public"."member_role")) AND "public"."can_write_story"("story_id")));



CREATE POLICY "authors and co-hosts delete notes" ON "public"."notes" FOR DELETE TO "authenticated" USING (((("author_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."story_role"("story_id") >= 'cohost'::"public"."member_role")) AND "public"."can_write_story"("story_id")));



CREATE POLICY "authors edit their note replies" ON "public"."note_replies" FOR UPDATE TO "authenticated" USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."can_write_story"("story_id"))) WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."can_write_story"("story_id")));



CREATE POLICY "authors edit their notes" ON "public"."notes" FOR UPDATE TO "authenticated" USING ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."can_write_story"("story_id"))) WITH CHECK ((("author_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."can_write_story"("story_id")));



CREATE POLICY "both sides see the connection" ON "public"."friendships" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "requester_id") OR (( SELECT "auth"."uid"() AS "uid") = "addressee_id")));



CREATE POLICY "changes to visible stories are readable" ON "public"."story_changes" FOR SELECT TO "authenticated", "anon" USING ("public"."can_view_story"("story_id"));



ALTER TABLE "public"."chapter_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chapters of visible stories are readable" ON "public"."chapters" FOR SELECT TO "authenticated", "anon" USING ("public"."can_view_story"("story_id"));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "co-hosts delete entries" ON "public"."entries" FOR DELETE TO "authenticated" USING ((("public"."story_role"("story_id") >= 'cohost'::"public"."member_role") AND "public"."can_write_story"("story_id")));



CREATE POLICY "co-hosts name snapshots" ON "public"."chapter_snapshots" FOR UPDATE TO "authenticated" USING (("public"."story_role"("public"."chapter_story"("chapter_id")) >= 'cohost'::"public"."member_role")) WITH CHECK (("public"."story_role"("public"."chapter_story"("chapter_id")) >= 'cohost'::"public"."member_role"));



CREATE POLICY "co-hosts read snapshots" ON "public"."chapter_snapshots" FOR SELECT TO "authenticated" USING (("public"."story_role"("public"."chapter_story"("chapter_id")) >= 'cohost'::"public"."member_role"));



CREATE POLICY "co-hosts update chapters" ON "public"."chapters" FOR UPDATE TO "authenticated" USING (("public"."story_role"("story_id") >= 'cohost'::"public"."member_role")) WITH CHECK (("public"."story_role"("story_id") >= 'cohost'::"public"."member_role"));



CREATE POLICY "either side removes the connection" ON "public"."friendships" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "requester_id") OR (( SELECT "auth"."uid"() AS "uid") = "addressee_id")));



ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entries of visible stories are readable" ON "public"."entries" FOR SELECT TO "authenticated", "anon" USING ("public"."can_view_story"("story_id"));



ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hosts update their story" ON "public"."stories" FOR UPDATE TO "authenticated" USING (("public"."story_role"("id") = 'host'::"public"."member_role")) WITH CHECK (("public"."story_role"("id") = 'host'::"public"."member_role"));



CREATE POLICY "invitees and co-hosts delete invites" ON "public"."invites" FOR DELETE TO "authenticated" USING ((("invitee_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."story_role"("story_id") >= 'cohost'::"public"."member_role")));



CREATE POLICY "invitees and co-hosts see invites" ON "public"."invites" FOR SELECT TO "authenticated" USING ((("invitee_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("public"."story_role"("story_id") >= 'cohost'::"public"."member_role")));



ALTER TABLE "public"."invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members of visible stories are readable" ON "public"."story_members" FOR SELECT TO "authenticated", "anon" USING ("public"."can_view_story"("story_id"));



CREATE POLICY "members post to story chat" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((("public"."story_role"("story_id") IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "members read note replies" ON "public"."note_replies" FOR SELECT TO "authenticated" USING (("public"."story_role"("story_id") IS NOT NULL));



CREATE POLICY "members read notes" ON "public"."notes" FOR SELECT TO "authenticated" USING (("public"."story_role"("story_id") IS NOT NULL));



CREATE POLICY "members read story chat" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (("public"."story_role"("story_id") IS NOT NULL));



ALTER TABLE "public"."note_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "presence in visible stories is readable" ON "public"."story_presence" FOR SELECT TO "authenticated", "anon" USING ("public"."can_view_story"("story_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles are public" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "recipients mark their notifications read" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "recipients read their notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("recipient_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."story_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users create their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users send requests as themselves" ON "public"."friendships" FOR INSERT TO "authenticated" WITH CHECK ((("requester_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"public"."friendship_status")));



CREATE POLICY "users update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "visible stories are readable" ON "public"."stories" FOR SELECT TO "authenticated", "anon" USING ("public"."can_view_story"("id"));



CREATE POLICY "writers add entries" ON "public"."entries" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_write_story"("story_id") AND ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "writers update entries" ON "public"."entries" FOR UPDATE TO "authenticated" USING ("public"."can_write_story"("story_id")) WITH CHECK ("public"."can_write_story"("story_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."note_replies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."story_changes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."story_presence";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."accept_invite"("p_invite" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invite"("p_invite" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite"("p_invite" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_invite_link"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_invite_link"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invite_link"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_chapter"("p_story" "uuid", "p_title" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_chapter"("p_story" "uuid", "p_title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_chapter"("p_story" "uuid", "p_title" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_note"("p_id" "uuid", "p_chapter" "uuid", "p_quote" "text", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_note"("p_id" "uuid", "p_chapter" "uuid", "p_quote" "text", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_note"("p_id" "uuid", "p_chapter" "uuid", "p_quote" "text", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."are_friends"("a" "uuid", "b" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."are_friends"("a" "uuid", "b" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assign_story_color"("p_story" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_story_color"("p_story" "uuid", "p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."author_palette"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."author_palette"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."author_palette"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."authorize_restore"("p_snapshot" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authorize_restore"("p_snapshot" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authorize_restore"("p_snapshot" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."authorize_snapshot"("p_chapter" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."authorize_snapshot"("p_chapter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."authorize_snapshot"("p_chapter" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."befriend"("a" "uuid", "b" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."befriend"("a" "uuid", "b" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_story"("p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_story"("p_story" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_story"("p_story" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."can_view_story"("p_story" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."can_write_story"("p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_write_story"("p_story" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_write_story"("p_story" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."chapter_story"("p_chapter" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."chapter_story"("p_chapter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."chapter_story"("p_chapter" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_invite_link"("p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_invite_link"("p_story" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invite_link"("p_story" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_story"("p_title" "text", "p_visibility" "public"."story_visibility", "p_blurb" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_story"("p_title" "text", "p_visibility" "public"."story_visibility", "p_blurb" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_story"("p_title" "text", "p_visibility" "public"."story_visibility", "p_blurb" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_chapter"("p_chapter" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_chapter"("p_chapter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_chapter"("p_chapter" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_story"("p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_story"("p_story" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_story"("p_story" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finished_public_stories"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finished_public_stories"() TO "anon";
GRANT ALL ON FUNCTION "public"."finished_public_stories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."finished_public_stories"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."forget_story_notifications"("p_story" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."forget_story_notifications"("p_story" "uuid", "p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."friends_presence"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."friends_presence"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."friends_presence"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."heartbeat"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."heartbeat"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."heartbeat"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_friend"("p_story" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_friend"("p_story" "uuid", "p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_friend"("p_story" "uuid", "p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."invite_link_preview"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."invite_link_preview"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_link_preview"("p_token" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."invite_link_preview"("p_token" "text") TO "anon";



REVOKE ALL ON FUNCTION "public"."keep_story_colors"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."keep_story_colors"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."leave_story"("p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leave_story"("p_story" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_story"("p_story" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."live_public_stories"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."live_public_stories"() TO "anon";
GRANT ALL ON FUNCTION "public"."live_public_stories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."live_public_stories"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_notification_read"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_notifications_read"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_notifications_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notifications_read"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."move_chapter_to"("p_chapter" "uuid", "p_after" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."move_chapter_to"("p_chapter" "uuid", "p_after" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_chapter_to"("p_chapter" "uuid", "p_after" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."next_free_color"("p_taken" "text"[], "p_preferred" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_free_color"("p_taken" "text"[], "p_preferred" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_free_color"("p_taken" "text"[], "p_preferred" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify"("p_recipients" "uuid"[], "p_kind" "public"."notification_kind", "p_story" "uuid", "p_detail" "jsonb", "p_invite" "uuid", "p_note" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify"("p_recipients" "uuid"[], "p_kind" "public"."notification_kind", "p_story" "uuid", "p_detail" "jsonb", "p_invite" "uuid", "p_note" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_added_writer_mentions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_added_writer_mentions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_chat_writer_mentions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_chat_writer_mentions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_stories"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_stories"() TO "anon";
GRANT ALL ON FUNCTION "public"."public_stories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."public_stories"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_member"("p_story" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_member"("p_story" "uuid", "p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_member"("p_story" "uuid", "p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reply_note"("p_note" "uuid", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reply_note"("p_note" "uuid", "p_body" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reply_note"("p_note" "uuid", "p_body" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_edited_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_edited_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_member_role"("p_story" "uuid", "p_user" "uuid", "p_role" "public"."member_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_member_role"("p_story" "uuid", "p_user" "uuid", "p_role" "public"."member_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_member_role"("p_story" "uuid", "p_user" "uuid", "p_role" "public"."member_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_note_resolved"("p_note" "uuid", "p_resolved" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_note_resolved"("p_note" "uuid", "p_resolved" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_note_resolved"("p_note" "uuid", "p_resolved" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_story_color"("p_story" "uuid", "p_color" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_story_color"("p_story" "uuid", "p_color" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_story_color"("p_story" "uuid", "p_color" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_story_finished"("p_story" "uuid", "p_finished" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_story_finished"("p_story" "uuid", "p_finished" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_story_finished"("p_story" "uuid", "p_finished" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_story_notify"("p_story" "uuid", "p_notify" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_story_notify"("p_story" "uuid", "p_notify" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_story_notify"("p_story" "uuid", "p_notify" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."story_changed"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."story_changed"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."story_colors_taken"("p_story" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."story_colors_taken"("p_story" "uuid", "p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."story_member_ids"("p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."story_member_ids"("p_story" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."story_role"("p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."story_role"("p_story" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."story_role"("p_story" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."story_role"("p_story" "uuid") TO "anon";



REVOKE ALL ON FUNCTION "public"."transfer_host"("p_story" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfer_host"("p_story" "uuid", "p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_host"("p_story" "uuid", "p_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."writer_mention_ids"("p_body" "text", "p_story" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."writer_mention_ids"("p_body" "text", "p_story" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."writer_mention_text"("p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."writer_mention_text"("p_body" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."chapter_snapshots" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."chapter_snapshots" TO "authenticated";



GRANT SELECT("chapter_id") ON TABLE "public"."chapter_snapshots" TO "authenticated";



GRANT SELECT("taken_at") ON TABLE "public"."chapter_snapshots" TO "authenticated";



GRANT SELECT("name"),UPDATE("name") ON TABLE "public"."chapter_snapshots" TO "authenticated";



GRANT ALL ON TABLE "public"."chapters" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("id") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("story_id") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("story_id") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("position") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("position") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("title") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("title"),UPDATE("title") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("locked") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("locked"),UPDATE("locked") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("word_count") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("word_count") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("author_chars") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("author_chars") ON TABLE "public"."chapters" TO "authenticated";



GRANT SELECT("edited_at") ON TABLE "public"."chapters" TO "anon";
GRANT SELECT("edited_at") ON TABLE "public"."chapters" TO "authenticated";



GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";
GRANT SELECT ON TABLE "public"."chat_messages" TO "authenticated";



GRANT INSERT("story_id") ON TABLE "public"."chat_messages" TO "authenticated";



GRANT INSERT("body") ON TABLE "public"."chat_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."entries" TO "service_role";
GRANT DELETE ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("id") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("story_id") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("story_id"),INSERT("story_id") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("type") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("type"),INSERT("type"),UPDATE("type") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("name") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("name"),INSERT("name"),UPDATE("name") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("description") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("description"),INSERT("description"),UPDATE("description") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("created_by") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("created_by") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("aliases") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("aliases"),UPDATE("aliases") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT("link_entry_mentions") ON TABLE "public"."entries" TO "anon";
GRANT SELECT("link_entry_mentions"),UPDATE("link_entry_mentions") ON TABLE "public"."entries" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."friendships" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT UPDATE("status") ON TABLE "public"."friendships" TO "authenticated";



GRANT ALL ON TABLE "public"."invites" TO "anon";
GRANT ALL ON TABLE "public"."invites" TO "authenticated";
GRANT ALL ON TABLE "public"."invites" TO "service_role";



GRANT ALL ON TABLE "public"."note_replies" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."note_replies" TO "authenticated";



GRANT UPDATE("body") ON TABLE "public"."note_replies" TO "authenticated";



GRANT ALL ON TABLE "public"."notes" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."notes" TO "authenticated";



GRANT UPDATE("body") ON TABLE "public"."notes" TO "authenticated";



GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";



GRANT UPDATE("read_at") ON TABLE "public"."notifications" TO "authenticated";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("username") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("username") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("author_color") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("author_color") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("theme") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("theme") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT("show_online") ON TABLE "public"."profiles" TO "anon";
GRANT SELECT("show_online") ON TABLE "public"."profiles" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



GRANT UPDATE("title") ON TABLE "public"."stories" TO "authenticated";



GRANT UPDATE("visibility") ON TABLE "public"."stories" TO "authenticated";



GRANT UPDATE("blurb") ON TABLE "public"."stories" TO "authenticated";



GRANT ALL ON TABLE "public"."story_activity" TO "service_role";
GRANT SELECT ON TABLE "public"."story_activity" TO "anon";
GRANT SELECT ON TABLE "public"."story_activity" TO "authenticated";



GRANT ALL ON TABLE "public"."story_changes" TO "service_role";
GRANT SELECT ON TABLE "public"."story_changes" TO "anon";
GRANT SELECT ON TABLE "public"."story_changes" TO "authenticated";



GRANT ALL ON TABLE "public"."story_members" TO "anon";
GRANT ALL ON TABLE "public"."story_members" TO "authenticated";
GRANT ALL ON TABLE "public"."story_members" TO "service_role";



GRANT ALL ON TABLE "public"."story_presence" TO "service_role";
GRANT SELECT ON TABLE "public"."story_presence" TO "anon";
GRANT SELECT ON TABLE "public"."story_presence" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































