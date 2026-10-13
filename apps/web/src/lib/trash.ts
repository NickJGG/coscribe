import { isUuid } from "./action-result";

const DAY_MS = 24 * 3600 * 1000;

/** "30 days left", "1 day left": rounded up, so it never says 0 while the item is still there. */
export function daysLeft(expiresAt: string, now = Date.now()): string {
  const days = Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / DAY_MS));
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

export type TrashedKind = "chapter" | "entry" | "story";

/** The `?trashed=<kind>:<id>` a delete redirects with, for its Undo toast. */
export function parseTrashed(param: unknown): { kind: TrashedKind; id: string } | null {
  if (typeof param !== "string") return null;
  const [kind, id] = param.split(":");
  if ((kind !== "chapter" && kind !== "entry" && kind !== "story") || !isUuid(id)) return null;
  return { kind, id };
}
