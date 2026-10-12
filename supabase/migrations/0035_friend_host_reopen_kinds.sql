-- Notification kinds for friend requests, Host transfer and Reopen. On their own because Postgres can't use a
-- new enum value in the transaction that adds it, and 0036 does.

alter type public.notification_kind add value 'friend_request';
alter type public.notification_kind add value 'friend_accepted';
alter type public.notification_kind add value 'host_changed';
alter type public.notification_kind add value 'story_reopened';
