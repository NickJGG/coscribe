-- Per-Story notifications. 'mine' drops the Story-wide news (new Chapters, new Writers); everything else
-- is already about the recipient, or (Finished, deleted) wanted by everyone.

alter table public.story_members
  add column notify text not null default 'all' check (notify in ('all', 'mine'));

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
      p_kind in ('writer_joined', 'chapter_added')
      and exists (
        select 1 from public.story_members m
        where m.story_id = p_story and m.user_id = r and m.notify = 'mine'
      )
    );
$$;

create function public.set_story_notify(p_story uuid, p_notify text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke execute on function public.set_story_notify(uuid, text) from public, anon;
