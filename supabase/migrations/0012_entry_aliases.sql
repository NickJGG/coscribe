-- Aliases are other names an Entry goes by in the prose. Together with the name they find its Mentions,
-- unless link_mentions is off (for an Entry whose name is a common word).
alter table public.entries
  add column aliases text[] not null default '{}' check (cardinality(aliases) <= 20),
  add column link_mentions boolean not null default true;

grant select (aliases, link_mentions) on public.entries to anon, authenticated;
grant update (aliases, link_mentions) on public.entries to authenticated;
