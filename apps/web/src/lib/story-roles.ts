import type { Database } from "@/lib/supabase/database.types";

// UI-side mirror of the checks in the SQL RPCs (supabase/migrations/0003_stories.sql), which stay authoritative.

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLE_LABEL: Record<MemberRole, string> = {
  host: "Host",
  cohost: "Co-host",
  writer: "Writer",
  viewer: "Viewer",
};

/** Host included; one per Author Color (`AUTHOR_COLORS`). Mirrors `story_full` in 0047_invite_link_expiry.sql. */
export const MAX_WRITERS = 12;

export const INVITE_LINK_DAYS = [1, 7, 30] as const;
export type InviteLinkDays = (typeof INVITE_LINK_DAYS)[number];

export function isInviteLinkDays(days: unknown): days is InviteLinkDays {
  return INVITE_LINK_DAYS.includes(days as InviteLinkDays);
}

const RANK: Record<MemberRole, number> = { viewer: -1, writer: 0, cohost: 1, host: 2 };

export function atLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
  return role != null && RANK[role] >= RANK[min];
}

/** A member who writes: anyone but an invited Viewer. */
export function isWriter(role: MemberRole | null | undefined): boolean {
  return atLeast(role, "writer");
}

/** Reorder, rename, delete, and lock or unlock Chapters. */
export function canManageChapters(actor: MemberRole | null | undefined): boolean {
  return atLeast(actor, "cohost");
}

/** Take, name, compare and Restore a Chapter's or Entry's Snapshots. Mirrors the RLS on chapter_snapshots and entry_snapshots. */
export function canManageSnapshots(actor: MemberRole | null | undefined): boolean {
  return atLeast(actor, "cohost");
}

/** Mirrors Chapters: any Writer adds and edits Entries, Co-hosts and up delete them. */
export function canDeleteEntries(actor: MemberRole | null | undefined): boolean {
  return atLeast(actor, "cohost");
}

/** A whole Note (with its replies), or a single reply: its writer, or Co-hosts and up. */
export function canDeleteNote(actor: MemberRole | null | undefined, isAuthor: boolean): boolean {
  return isWriter(actor) && (isAuthor || atLeast(actor, "cohost"));
}

export function canManageInvites(actor: MemberRole | null | undefined): boolean {
  return atLeast(actor, "cohost");
}

export function canRemove(actor: MemberRole | null | undefined, target: MemberRole): boolean {
  if (target === "host" || !atLeast(actor, "cohost")) return false;
  return !atLeast(target, "cohost") || actor === "host";
}

/** Make Co-host, Make Writer (from Co-host), or Hand off Host. */
export function canChangeRole(actor: MemberRole | null | undefined, target: MemberRole): boolean {
  return actor === "host" && isWriter(target) && target !== "host";
}

/** Make Writer or Make Viewer, between those two roles on Private stories. */
export function canSwapViewer(actor: MemberRole | null | undefined, target: MemberRole, isPrivate: boolean): boolean {
  return isPrivate && atLeast(actor, "cohost") && (target === "writer" || target === "viewer");
}

export function canLeave(role: MemberRole | null | undefined): boolean {
  return role != null && role !== "host";
}
