/** A document with Snapshots: a Chapter or a Story Bible Entry. */
export type SnapshotKind = "chapter" | "entry";

export const SNAPSHOT_KINDS = {
  chapter: { noun: "Chapter", table: "chapter_snapshots", column: "chapter_id" },
  entry: { noun: "Entry", table: "entry_snapshots", column: "entry_id" },
} as const satisfies Record<SnapshotKind, unknown>;
