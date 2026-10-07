-- Written by apps/sync alongside ydoc, so pages can show counts without decoding Yjs state.
-- author_chars maps author userId to surviving characters, as Credits counts them.
-- edited_at is null until the sync server first stores (or backfills) the Chapter.
alter table public.chapters
  add column word_count integer not null default 0,
  add column author_chars jsonb not null default '{}',
  add column edited_at timestamptz;

grant select (word_count, author_chars, edited_at) on public.chapters to anon, authenticated;
