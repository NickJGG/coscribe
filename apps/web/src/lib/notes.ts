import type { Database } from "@/lib/supabase/database.types";

// Notes: threads pinned to a passage of a Chapter by a `note` mark (supabase/migrations/0018_notes.sql).

type Tables = Database["public"]["Tables"];

export type Note = Omit<Tables["notes"]["Row"], "story_id">;
export type NoteReply = Omit<Tables["note_replies"]["Row"], "story_id">;

export const NOTE_COLUMNS = "id, chapter_id, author_id, quote, body, edited_at, resolved_at, resolved_by, created_at";
export const REPLY_COLUMNS = "id, note_id, chapter_id, author_id, body, edited_at, created_at";

export const NOTE_BODY_MAX = 2000;
export const NOTE_QUOTE_MAX = 300;

/** The selected passage as stored with a new Note: whitespace collapsed, cut to fit with an ellipsis. */
export function noteQuote(text: string): string {
  const quote = text.replace(/\s+/g, " ").trim();
  const chars = [...quote];
  return chars.length <= NOTE_QUOTE_MAX ? quote : chars.slice(0, NOTE_QUOTE_MAX - 1).join("").trimEnd() + "…";
}

const time = (iso: string) => Date.parse(iso);

export type NoteGroups = { open: Note[]; resolved: Note[]; detached: Note[] };

/**
 * Open Notes whose passage is in the doc, in document order; Resolved ones, latest first; and open ones
 * whose passage is gone. `ranges` is `noteRanges` of the live doc.
 */
export function groupNotes(notes: readonly Note[], ranges: ReadonlyMap<string, { from: number }>): NoteGroups {
  const groups: NoteGroups = { open: [], resolved: [], detached: [] };
  for (const note of notes) {
    if (note.resolved_at) groups.resolved.push(note);
    else if (ranges.has(note.id)) groups.open.push(note);
    else groups.detached.push(note);
  }
  groups.open.sort((a, b) => ranges.get(a.id)!.from - ranges.get(b.id)!.from || time(a.created_at) - time(b.created_at));
  groups.resolved.sort((a, b) => time(b.resolved_at!) - time(a.resolved_at!));
  groups.detached.sort((a, b) => time(a.created_at) - time(b.created_at));
  return groups;
}
