-- Mention became Entry Mention, to make room for Writer Mentions.
alter table public.entries rename column link_mentions to link_entry_mentions;
