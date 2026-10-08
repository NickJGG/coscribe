-- Notification kinds for Notes. On their own because Postgres can't use a new enum value in the
-- transaction that adds it, and 0018 does.

alter type public.notification_kind add value 'note_reply';
alter type public.notification_kind add value 'note_resolved';
