-- The newest Changelog update the User has opened; the You menu shows a dot while a newer one exists.
-- Defaulting to today starts every account cleared, so only updates published from here on show the dot.
alter table public.profiles add column changelog_seen date not null default current_date;

-- Profiles are readable column by column (0013); this is only read by its own account.
grant select (changelog_seen) on public.profiles to authenticated;
