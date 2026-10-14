-- Deleting an account. A Host hands over every live Story that has other Writers first; the rest of their
-- Hosted Stories, and their Trash, go with them. Their words stay in the Stories, unnamed.

alter table public.chat_messages
  alter column user_id drop not null,
  drop constraint chat_messages_user_id_fkey,
  add constraint chat_messages_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete set null;

-- Holds even for a delete from the dashboard: no Story is ever left without a Host.
create function public.profiles_guard_hosted_stories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.story_members h
    join public.stories s on s.id = h.story_id
    join public.story_members o on o.story_id = h.story_id
    where h.user_id = old.id and h.role = 'host' and s.deleted_at is null
      and o.user_id <> old.id and o.role >= 'writer'
  ) then
    raise exception 'host_has_writers';
  end if;
  return old;
end;
$$;

revoke execute on function public.profiles_guard_hosted_stories() from public, anon, authenticated;

create trigger profiles_guard_hosted_stories before delete on public.profiles
  for each row execute function public.profiles_guard_hosted_stories();

-- Returns every Story the User was in, so the caller can refresh sync's access to them.
create function public.delete_account(p_username text)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  story_ids uuid[];
begin
  if not exists (select 1 from public.profiles where id = me and username = p_username) then
    raise exception 'username_mismatch';
  end if;

  story_ids := array(select story_id from public.story_members where user_id = me);

  delete from public.stories s
  using public.story_members h
  where h.story_id = s.id and h.user_id = me and h.role = 'host'
    and (
      s.deleted_at is not null
      or not exists (
        select 1 from public.story_members o
        where o.story_id = s.id and o.user_id <> me and o.role >= 'writer'
      )
    );

  delete from auth.users where id = me;

  return query select unnest(story_ids);
end;
$$;

revoke execute on function public.delete_account(text) from public, anon;
grant execute on function public.delete_account(text) to authenticated;
