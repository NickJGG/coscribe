create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- One connection per pair, whichever side asked.
create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy "both sides see the connection"
  on public.friendships for select
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy "users send requests as themselves"
  on public.friendships for insert
  to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

create policy "addressees accept requests"
  on public.friendships for update
  to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (status = 'accepted');

-- Covers declining, cancelling, and unfriending.
create policy "either side removes the connection"
  on public.friendships for delete
  to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;

-- Accepts any pending connection between the two users, or creates an accepted one.
create function public.befriend(a uuid, b uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.friendships (requester_id, addressee_id, status)
  values (a, b, 'accepted')
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  do update set status = 'accepted';
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.befriend(uuid, uuid) from public, anon, authenticated;
