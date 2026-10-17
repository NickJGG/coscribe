import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { noteRanges } from "@coscribe/editor";
import type { Database } from "@/lib/supabase/database.types";

// Notes: threads pinned to a passage of a Chapter or Entry by a `note` mark (supabase/migrations/0018_notes.sql),
// on a whole Chapter or Entry, with no quote, or on the Story, with no document either (0054).

type Tables = Database["public"]["Tables"];

export type Note = Omit<Tables["notes"]["Row"], "story_id">;
export type NoteReply = Omit<Tables["note_replies"]["Row"], "story_id">;

export const NOTE_COLUMNS = "id, chapter_id, entry_id, author_id, quote, body, edited_at, resolved_at, resolved_by, created_at";
export const REPLY_COLUMNS = "id, note_id, chapter_id, entry_id, author_id, body, edited_at, created_at";

export const NOTE_BODY_MAX = 2000;
export const NOTE_QUOTE_MAX = 300;

/** The selected passage as stored with a new Note: whitespace collapsed, cut to fit with an ellipsis. */
export function noteQuote(text: string): string {
  const quote = text.replace(/\s+/g, " ").trim();
  const chars = [...quote];
  return chars.length <= NOTE_QUOTE_MAX ? quote : chars.slice(0, NOTE_QUOTE_MAX - 1).join("").trimEnd() + "…";
}

/** A Note on its whole Chapter or Entry rather than a passage of it. */
export function isWhole(note: Pick<Note, "quote">): boolean {
  return note.quote === null;
}

const time = (iso: string) => Date.parse(iso);

export type NoteGroups = { open: Note[]; resolved: Note[]; detached: Note[] };

/**
 * Open Notes on the whole document, oldest first, then those whose passage is in the doc, in document
 * order; Resolved ones, latest first; and open ones whose passage is gone. `ranges` is `noteRanges` of the
 * live doc.
 */
export function groupNotes(notes: readonly Note[], ranges: ReadonlyMap<string, { from: number }>): NoteGroups {
  const groups: NoteGroups = { open: [], resolved: [], detached: [] };
  for (const note of notes) {
    if (note.resolved_at) groups.resolved.push(note);
    else if (isWhole(note) || ranges.has(note.id)) groups.open.push(note);
    else groups.detached.push(note);
  }
  const at = (note: Note) => (isWhole(note) ? -1 : ranges.get(note.id)!.from);
  groups.open.sort((a, b) => at(a) - at(b) || time(a.created_at) - time(b.created_at));
  groups.resolved.sort((a, b) => time(b.resolved_at!) - time(a.resolved_at!));
  groups.detached.sort((a, b) => time(a.created_at) - time(b.created_at));
  return groups;
}

/** Open Notes, the one with the newest reply (or, without replies, the newest) first. */
export function latestActivity(notes: readonly Note[], replies: readonly NoteReply[]): Note[] {
  const latest = new Map<string, number>();
  for (const r of replies) latest.set(r.note_id, Math.max(latest.get(r.note_id) ?? 0, time(r.created_at)));
  const at = (note: Note) => Math.max(time(note.created_at), latest.get(note.id) ?? 0);
  return notes.filter((n) => !n.resolved_at).sort((a, b) => at(b) - at(a));
}

/**
 * Tops for margin cards that each want to sit at `wants[i]` (in document order), so none overlap: the
 * active card keeps its place, later cards push down below it, earlier ones push up above it.
 */
export function stackCards(wants: readonly number[], heights: readonly number[], active: number, gap: number): number[] {
  const tops = [...wants];
  const pivot = Math.max(0, Math.min(active, wants.length - 1));
  for (let i = pivot + 1; i < tops.length; i++) tops[i] = Math.max(wants[i]!, tops[i - 1]! + heights[i - 1]! + gap);
  for (let i = pivot - 1; i >= 0; i--) tops[i] = Math.min(wants[i]!, tops[i + 1]! - heights[i]! - gap);
  return tops;
}

/** Open Notes grouped by the paragraph their passage starts in, in document order, each with where its marker goes. */
export function markerGroups(doc: ProseMirrorNode, openIds: ReadonlySet<string>): { ids: string[]; at: number }[] {
  const groups = new Map<number, { ids: string[]; at: number }>();
  const ranges = [...noteRanges(doc)].filter(([id]) => openIds.has(id)).sort(([, a], [, b]) => a.from - b.from);
  for (const [id, { from, to }] of ranges) {
    const $from = doc.resolve(from);
    const at = Math.min(to, $from.end());
    const group = groups.get($from.start());
    if (group) {
      group.ids.push(id);
      group.at = Math.max(group.at, at);
    } else {
      groups.set($from.start(), { ids: [id], at });
    }
  }
  return [...groups.values()];
}
