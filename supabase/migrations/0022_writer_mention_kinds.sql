-- Notification kinds for Writer Mentions. On their own because Postgres can't use a new enum value in the
-- transaction that adds it, and 0023 does.

alter type public.notification_kind add value 'note_mention';
alter type public.notification_kind add value 'chat_mention';
