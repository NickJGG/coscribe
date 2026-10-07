/** A `story_presence` row: one Writer with one document open. */
export type PresenceRow = { id: string; user_id: string; kind: string; document_id: string; connected_at: string };

export type PresentWriter = { userId: string; kind: string; documentId: string };

/** Each Writer once (except `me`), earliest arrival first, at the document they opened most recently. */
export function presentWriters(rows: PresenceRow[], me?: string | null): PresentWriter[] {
  const byUser = new Map<string, { since: string; latest: PresenceRow }>();
  for (const row of rows) {
    if (row.user_id === me) continue;
    const seen = byUser.get(row.user_id);
    if (!seen) byUser.set(row.user_id, { since: row.connected_at, latest: row });
    else {
      if (row.connected_at < seen.since) seen.since = row.connected_at;
      if (row.connected_at > seen.latest.connected_at) seen.latest = row;
    }
  }
  return [...byUser.values()]
    .sort((a, b) => a.since.localeCompare(b.since))
    .map(({ latest }) => ({ userId: latest.user_id, kind: latest.kind, documentId: latest.document_id }));
}

/** "mia", "mia and theo", "mia, theo and sam", "mia, theo and 2 others". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`;
}

/**
 * What a Story's row says while Writers are in it: "theo is writing Chapter 3". `chapter` is the
 * Chapter's number, or null in the Story Bible. Null when nobody is there.
 */
export function writingLine(present: { name: string; chapter: number | null }[]): string | null {
  if (!present.length) return null;
  const names = joinNames(present.map((p) => p.name));
  const chapters = new Set(present.map((p) => p.chapter));
  const [chapter] = chapters;
  if (chapters.size > 1) return `${names} are writing`;
  if (chapter == null) return `${names} ${present.length === 1 ? "is" : "are"} in the Story Bible`;
  return `${names} ${present.length === 1 ? "is" : "are"} writing Chapter ${chapter}`;
}
