-- Clicking a Notification's toast marks just that one read.

create function public.mark_notification_read(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where id = p_id and recipient_id = (select auth.uid()) and read_at is null;
$$;

revoke execute on function public.mark_notification_read(uuid) from public, anon;
