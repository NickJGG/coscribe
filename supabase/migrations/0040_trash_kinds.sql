-- Notification kinds for the Trash. On their own because Postgres can't use a new enum value in the
-- transaction that adds it, and 0041 does.

alter type public.notification_kind add value 'moved_to_trash';
alter type public.notification_kind add value 'restored';
alter type public.notification_kind add value 'story_restored';
