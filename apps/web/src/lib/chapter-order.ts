/**
 * Targets for `moveChapterTo`, which names the Chapter to land after (null for first).
 * `undefined` means the move isn't possible from that row.
 */
export function moveTargets(ids: string[], i: number): { up?: string | null; down?: string } {
  return {
    up: i === 0 ? undefined : i === 1 ? null : ids[i - 2],
    down: i === ids.length - 1 ? undefined : ids[i + 1],
  };
}

/** The id just before `index` in the new order, or null at the top. */
export function afterId(ids: string[], index: number): string | null {
  return index > 0 ? ids[index - 1] : null;
}
