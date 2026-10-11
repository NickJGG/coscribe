/** Pinned Entry ids, newest first. Loaded by `getPins` in lib/story.ts. */

export function withPin(ids: string[], id: string): string[] {
  return [id, ...ids.filter((i) => i !== id)];
}

export function withoutPin(ids: string[], id: string): string[] {
  return ids.filter((i) => i !== id);
}

/** Drops pins whose Entry is gone. */
export function visiblePins(ids: string[], entries: { id: string }[]): string[] {
  const present = new Set(entries.map((e) => e.id));
  return ids.filter((id) => present.has(id));
}
