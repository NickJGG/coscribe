import { IMPORTED_AUTHOR } from "@coscribe/editor";
import type { MemberRole } from "@/lib/story-roles";
import type { RibbonSegment } from "@/components/ContributionRibbon";

export type RibbonMember = { id: string; name: string; color: string; role: MemberRole; joinedAt: string };

/** Host first, then everyone else in the order they joined. */
export function byJoinOrder(a: { role: MemberRole; joinedAt: string }, b: { role: MemberRole; joinedAt: string }) {
  return Number(b.role === "host") - Number(a.role === "host") || a.joinedAt.localeCompare(b.joinedAt);
}

/** A `chapters.author_chars` value, keeping only well-formed counts by accounts (not Imported Text). */
export function readAuthorChars(json: unknown): Record<string, number> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return Object.fromEntries(
    Object.entries(json).filter(
      (e): e is [string, number] => e[0] !== IMPORTED_AUTHOR && typeof e[1] === "number" && e[1] > 0
    )
  );
}

export function sumAuthorChars(chapters: Record<string, number>[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const chars of chapters) {
    for (const [id, n] of Object.entries(chars)) totals.set(id, (totals.get(id) ?? 0) + n);
  }
  return totals;
}

/**
 * A Story's ribbon: current members in join order (Host first), then former Writers in grey, largest
 * first. Anyone with no surviving text is left out, so an empty Story has no segments.
 */
export function storyRibbon(
  members: RibbonMember[],
  chapters: Record<string, number>[],
  formerNames: ReadonlyMap<string, string>
): RibbonSegment[] {
  const totals = sumAuthorChars(chapters);
  const memberIds = new Set(members.map((m) => m.id));
  const current = [...members]
    .sort(byJoinOrder)
    .map((m) => ({ id: m.id, name: m.name, color: m.color, chars: totals.get(m.id) ?? 0 }));
  const former = [...totals]
    .filter(([id]) => !memberIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id, chars]) => ({ id, name: formerNames.get(id) ?? "a former Writer", color: null, chars }));
  return [...current, ...former].filter((s) => s.chars > 0);
}

export type AuthorRun = { author: string; chars: number };

/** One paragraph's split margin bar: each author's characters, in the order they first appear. */
export function paragraphShares(runs: AuthorRun[]): AuthorRun[] {
  const totals = new Map<string, number>();
  for (const { author, chars } of runs) {
    if (chars > 0) totals.set(author, (totals.get(author) ?? 0) + chars);
  }
  return [...totals].map(([author, chars]) => ({ author, chars }));
}
