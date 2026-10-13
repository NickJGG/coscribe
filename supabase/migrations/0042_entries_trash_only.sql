-- Entries now only leave through the Trash (trash_entry), so a Co-host can't hard-delete one through the
-- API. Ship only once the web app that calls trash_entry is live.

drop policy "co-hosts delete entries" on public.entries;
revoke delete on public.entries from authenticated;
