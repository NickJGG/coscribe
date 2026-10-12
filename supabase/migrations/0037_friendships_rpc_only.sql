-- Friend requests go through send_friend_request, accept_friend_request and remove_friendship (0036), which
-- also notify. Direct writes would skip the notifications, so only reads stay open.

drop policy "users send requests as themselves" on public.friendships;
drop policy "addressees accept requests" on public.friendships;
drop policy "either side removes the connection" on public.friendships;

revoke insert, update, delete on public.friendships from anon, authenticated;
