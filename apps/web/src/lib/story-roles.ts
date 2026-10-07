import type { Database } from "@/lib/supabase/database.types";

// UI-side mirror of the checks in the SQL RPCs (supabase/migrations/0003_stories.sql), which stay authoritative.

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLE_LABEL: Record<MemberRole, string> = {
  host: "Host",
  cohost: "Co-host",
  writer: "Writer",
};

const RANK: Record<MemberRole, number> = { writer: 0, cohost: 1, host: 2 };

export function atLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
  return role != null && RANK[role] >= RANK[min];
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
