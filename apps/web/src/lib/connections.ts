import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type Person = { id: string; username: string; author_color: string };

const byName = (a: { other: Person }, b: { other: Person }) => a.other.username.localeCompare(b.other.username);

/** The viewer's Friends and pending requests either way, each sorted by username. */
export const getFriendships = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("friendships").select(`
    requester_id, addressee_id, status,
    requester:profiles!friendships_requester_id_fkey (id, username, author_color),
    addressee:profiles!friendships_addressee_id_fkey (id, username, author_color)
  `);
  const connections = (data ?? []).map((row) => ({
    ...row,
    other: row.requester_id === userId ? row.addressee : row.requester,
  }));
  return {
    connections,
    friends: connections.filter((c) => c.status === "accepted").sort(byName),
    incoming: connections.filter((c) => c.status === "pending" && c.addressee_id === userId).sort(byName),
    outgoing: connections.filter((c) => c.status === "pending" && c.requester_id === userId).sort(byName),
  };
});

/** Invites waiting for the viewer to join or decline, newest first. Invites to a trashed Story are left out. */
export const getPendingInvites = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invites")
    .select("id, role, story:stories!inner (id, title), inviter:profiles!invites_invited_by_fkey (id, username, author_color)")
    .eq("invitee_id", userId)
    .is("used_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
});
