-- Smart punctuation: curly quotes, em dashes and ellipses as Writers type. A Story setting, set by its Host.

alter table public.stories add column smart_punctuation boolean not null default true;

grant update (smart_punctuation) on public.stories to authenticated;

create trigger story_changed_smart_punctuation after update of smart_punctuation on public.stories
  for each row execute function public.story_changed();
