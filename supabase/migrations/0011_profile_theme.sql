-- 'system' follows the browser's prefers-color-scheme; the others pin data-theme on <html>.
create type public.theme as enum ('light', 'dark', 'system');

alter table public.profiles
  add column theme public.theme not null default 'system';
