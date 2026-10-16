-- A Character's Voice: the kind of speech voice its dialogue is narrated in (null is Any) and its pitch
-- (-1 Lower, 0 Normal, 1 Higher). Each device matches it to its closest voice. A Voice isn't part of an
-- Entry Snapshot.
alter table public.entries
  add column voice_kind text check (voice_kind in ('feminine', 'masculine')),
  add column voice_pitch smallint not null default 0 check (voice_pitch between -1 and 1);

grant select (voice_kind, voice_pitch) on public.entries to anon, authenticated;
grant update (voice_kind, voice_pitch) on public.entries to authenticated;

create trigger story_changed_voice after update of voice_kind, voice_pitch on public.entries
  for each row execute function public.story_changed();
