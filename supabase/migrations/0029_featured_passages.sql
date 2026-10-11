-- A User's Featured Passage: a stored copy of a slice of one Chapter of a Finished Story they wrote in,
-- quoted on their profile. Only apps/sync writes it (after checking the slice), so nobody can forge a quote.
create table public.featured_passages (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  story_id uuid not null references public.stories (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  content jsonb not null check (octet_length(content::text) <= 65536),
  created_at timestamptz not null default now()
);

create index featured_passages_story_idx on public.featured_passages (story_id);

alter table public.featured_passages enable row level security;

-- Hidden from visitors while its Story isn't Finished; the owner still sees it, to explain why.
create policy "featured passages of finished readable stories are readable"
  on public.featured_passages for select
  to anon, authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.can_view_story(story_id)
      and exists (select 1 from public.stories s where s.id = story_id and s.status = 'finished')
    )
  );

create policy "users remove their own featured passage"
  on public.featured_passages for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.featured_passages from anon, authenticated;
grant select on public.featured_passages to anon, authenticated;
grant delete on public.featured_passages to authenticated;

-- Leaving or being removed from a Story clears the passage quoted from it.
create function public.clear_featured_passage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.featured_passages where user_id = old.user_id and story_id = old.story_id;
  return old;
end;
$$;

revoke execute on function public.clear_featured_passage() from public, anon, authenticated;

create trigger clear_featured_passage after delete on public.story_members
  for each row execute function public.clear_featured_passage();
