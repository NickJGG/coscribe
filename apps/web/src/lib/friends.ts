export type Relation = "friends" | "incoming" | "outgoing" | "none";

export type FriendshipRow = {
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

export function relationTo(me: string, other: string, rows: readonly FriendshipRow[]): Relation {
  const row = rows.find(
    (r) =>
      (r.requester_id === me && r.addressee_id === other) || (r.requester_id === other && r.addressee_id === me)
  );
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester_id === me ? "outgoing" : "incoming";
}

/** Turns free text into a prefix pattern for `ilike`, escaping the LIKE wildcards usernames can contain. */
export function usernamePrefixPattern(raw: string): string | null {
  const q = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  return q ? `${q.replace(/_/g, "\\_")}%` : null;
}
