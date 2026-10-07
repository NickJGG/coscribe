-- Story Chat: visible to Writers and up only, never to Viewers.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index chat_messages_story_idx on public.chat_messages (story_id, created_at desc);

alter table public.chat_messages enable row level security;

create policy "members read story chat"
  on public.chat_messages for select
  to authenticated
  using (public.story_role(story_id) is not null);

create policy "members post to story chat"
  on public.chat_messages for insert
  to authenticated
  with check (public.story_role(story_id) is not null and user_id = (select auth.uid()));

revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;
grant insert (story_id, body) on public.chat_messages to authenticated;

-- Realtime checks the select policy per subscriber, so removed Writers stop receiving messages.
alter publication supabase_realtime add table public.chat_messages;
