/**
 * Targets for the move RPCs (`moveChapterTo`, `moveEntryTo`, `moveEntryType`), which name the item to land
 * after (null for first). `undefined` means the move isn't possible from that row.
 */
export function moveTargets<T>(ids: T[], i: number): { up?: T | null; down?: T } {
  return {
    up: i === 0 ? undefined : i === 1 ? null : ids[i - 2],
    down: i === ids.length - 1 ? undefined : ids[i + 1],
  };
}

/** The id just before `index` in the new order, or null at the top. */
export function afterId<T>(ids: T[], index: number): T | null {
  return index > 0 ? ids[index - 1] : null;
}

/** `order` with `item` moved to just after `after`, or first when it's null, as `move_entry_type_to` does. */
export function placeAfter<T>(order: T[], item: T, after: T | null): T[] {
  const rest = order.filter((t) => t !== item);
  rest.splice(after === null ? 0 : rest.indexOf(after) + 1, 0, item);
  return rest;
}
