import type { Database } from "@/lib/supabase/database.types";

// UI-side mirror of the checks in the SQL RPCs (supabase/migrations/0003_stories.sql), which stay authoritative.

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLE_LABEL: Record<MemberRole, string> = {
  host: "Host",
  cohost: "Co-host",
  writer: "Writer",
  viewer: "Viewer",
};

const RANK: Record<MemberRole, number> = { viewer: -1, writer: 0, cohost: 1, host: 2 };

export function atLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
  return role != null && RANK[role] >= RANK[min];
}

/** Reorder, rename, delete, and lock or unlock Chapters. */
export function canManageChapters(actor: MemberRole | null | undefined): boolean {
  return atLeast(actor, "cohost");
}

/** Mirrors Chapters: any Writer adds and edits Entries, Co-hosts and up delete them. */
export function canDeleteEntries(actor: MemberRole | null | undefined): boolean {
  return atLeast(actor, "cohost");
}

/** A whole Note (with its replies), or a single reply: its writer, or Co-hosts and up. */
export function canDeleteNote(actor: MemberRole | null | undefined, isAuthor: boolean): boolean {
  return actor != null && (isAuthor || atLeast(actor, "cohost"));
}

export function canManageInvites(actor: MemberRole | null | undefined): boolean {
  return atLeast(actor, "cohost");
}

export function canRemove(actor: MemberRole | null | undefined, target: MemberRole): boolean {
  if (target === "host" || !atLeast(actor, "cohost")) return false;
  return target === "writer" || actor === "host";
}

/** Promote, demote, or hand off Host to. */
export function canChangeRole(actor: MemberRole | null | undefined, target: MemberRole): boolean {
  return actor === "host" && target !== "host";
}

export function canLeave(role: MemberRole | null | undefined): boolean {
  return role != null && role !== "host";
}
