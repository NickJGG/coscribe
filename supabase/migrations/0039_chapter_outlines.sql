-- A Chapter's Outline: one live document per Chapter, for its Writers only. apps/sync creates the row on
-- first store and writes it over its direct connection; clients may only read whether it has content.
create table public.chapter_outlines (
  chapter_id uuid primary key references public.chapters on delete cascade,
  story_id uuid not null references public.stories on delete cascade,
  ydoc bytea,
  has_content boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.chapter_outlines enable row level security;

revoke all on public.chapter_outlines from anon, authenticated;
grant select (chapter_id, story_id, has_content) on public.chapter_outlines to authenticated;

create policy "writers read chapter outlines"
  on public.chapter_outlines for select
  to authenticated
  using (public.is_writer(story_id));
