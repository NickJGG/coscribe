-- Writing Days: minutes each User spent writing, per day in their own time zone. Recorded only by
-- apps/sync (bypassing RLS), which buffers the minutes a User sent edits in and flushes them once a minute.

-- Set by set_time_zone() from the browser. Private like last_seen (0013), so no select grant.
alter table public.profiles
  add column time_zone text,
  add column show_writing_days boolean not null default true;

grant select (show_writing_days) on public.profiles to anon, authenticated;

create table public.writing_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  minutes integer not null,
  primary key (user_id, day)
);

alter table public.writing_days enable row level security;
revoke all on public.writing_days from anon, authenticated;

-- The latest minute already counted, so a minute is never counted twice. Not on profiles, whose own row
-- a User can update freely.
create table public.writing_marks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_minute timestamptz not null
);

alter table public.writing_marks enable row level security;
revoke all on public.writing_marks from anon, authenticated;

create function public.set_time_zone(p_time_zone text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set time_zone = p_time_zone
  where id = (select auth.uid())
    and time_zone is distinct from p_time_zone
    and exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone);
$$;

revoke execute on function public.set_time_zone(text) from public, anon;
grant execute on function public.set_time_zone(text) to authenticated;
