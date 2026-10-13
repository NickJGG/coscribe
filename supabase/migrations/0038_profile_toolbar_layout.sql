-- Null is the default Formatting toolbar; otherwise [[group, [tool, ...]], ...]. The app merges it with the current tool set.
alter table public.profiles add column toolbar_layout jsonb;

-- Profiles are readable column by column (0013); the toolbar order is only read by its own account.
grant select (toolbar_layout) on public.profiles to authenticated;
