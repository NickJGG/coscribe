-- Pinned Entries: the Story Bible Entries a member keeps beside the Chapter while writing. Each member's
-- own, per Story, newest first. Nobody else can see them.
create table public.pinned_entries (
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index pinned_entries_user_story_idx on public.pinned_entries (user_id, story_id, pinned_at desc);
create index pinned_entries_entry_idx on public.pinned_entries (entry_id);

alter table public.pinned_entries enable row level security;

create policy "members read their own pins"
  on public.pinned_entries for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "members pin entries of their stories"
  on public.pinned_entries for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.story_role(story_id) is not null
    and exists (select 1 from public.entries e where e.id = entry_id and e.story_id = pinned_entries.story_id)
  );

create policy "members unpin their own pins"
  on public.pinned_entries for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.pinned_entries from anon, authenticated;
grant select, insert, delete on public.pinned_entries to authenticated;

-- Leaving or being removed from a Story clears your pins in it.
create function public.clear_pinned_entries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.pinned_entries where user_id = old.user_id and story_id = old.story_id;
  return old;
end;
$$;

revoke execute on function public.clear_pinned_entries() from public, anon, authenticated;

create trigger clear_pinned_entries after delete on public.story_members
  for each row execute function public.clear_pinned_entries();
