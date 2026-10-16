/**
 * Chapter and Entry Snapshots: the full Yjs state, taken after about 10 minutes of activity, when the last
 * connection leaves, and on demand by a Co-host. Skipped when the text (author marks included)
 * matches the latest one. Previews and Restores go through ProseMirror content, so `author` marks
 * come back with the text.
 *
 * A baseline is taken when a User's connection loads a document whose text differs from its latest
 * Snapshot (or that has none yet), so Entries from before Snapshots, and imported Chapters, gain one
 * before any edit.
 *
 * Open documents track whether taking a Snapshot would save anything, and tell their connections
 * (a SnapshotMessage) whenever that flips, so the Snapshot button grays out live.
 */
import type { Document, Hocuspocus } from "@hocuspocus/server"
import * as Y from "yjs"
import { documentName, type SnapshotMessage } from "@coscribe/editor"
import {
  chapterContent,
  contentHash,
  decodeChapter,
  replaceChapterContent,
  snapshotState,
  type ChapterContent,
} from "./chapter-content"
import { sql } from "./db"

export const SNAPSHOT_AFTER_MS = 10 * 60_000

export type SnapshotKind = "chapter" | "entry"

export type SnapshotDocument = { kind: SnapshotKind; id: string }

const TABLES = {
  chapter: { table: "chapter_snapshots", fk: "chapter_id", parent: "chapters" },
  entry: { table: "entry_snapshots", fk: "entry_id", parent: "entries" },
} satisfies Record<SnapshotKind, { table: string; fk: string; parent: string }>

export function isSnapshotKind(kind: string): kind is SnapshotKind {
  return kind in TABLES
}

/** Document name → when its first change since the last Snapshot was stored. */
const activeSince = new Map<string, number>()

/** Open document name → its latest Snapshot's content_hash (null: none yet). */
const latestHash = new Map<string, string | null>()

/** Open document name → the SnapshotMessage last sent to its connections. */
const published = new Map<string, string>()

const nameOf = ({ kind, id }: SnapshotDocument) => documentName(kind, id)

/** Returns whether a Snapshot was taken. */
export async function takeSnapshot(ref: SnapshotDocument, doc: Document, name: string | null = null): Promise<boolean> {
  const key = nameOf(ref)
  activeSince.delete(key)
  const content = chapterContent(doc, ref.kind)
  const hash = contentHash(content)
  const latest = await fetchLatestHash(ref)
  if (latest ? latest === hash : content.textContent === "") return false

  const { table, fk, parent } = TABLES[ref.kind]
  // A no-op if the document was deleted or moved to the Trash meanwhile.
  const inserted = await sql`
    insert into ${sql("public." + table)} (${sql(fk)}, state, content_hash, name)
    select ${ref.id}, ${Y.encodeStateAsUpdate(doc)}, ${hash}, ${name}
    where exists (select 1 from ${sql("public." + parent)} where id = ${ref.id} and deleted_at is null)
  `
  if (inserted.count === 0) return false
  if (latestHash.has(key)) {
    latestHash.set(key, hash)
    publish(ref, doc, content)
  }
  return true
}

async function fetchLatestHash(ref: SnapshotDocument): Promise<string | null> {
  const { table, fk } = TABLES[ref.kind]
  const [latest] = await sql<{ content_hash: string }[]>`
    select content_hash from ${sql("public." + table)}
    where ${sql(fk)} = ${ref.id}
    order by taken_at desc
    limit 1
  `
  return latest?.content_hash ?? null
}

/** `baseline` is false when the server loaded the document for its own Snapshot or Restore, which takes one itself. */
export async function documentLoaded(ref: SnapshotDocument, doc: Document, baseline: boolean): Promise<void> {
  const key = nameOf(ref)
  const latest = await fetchLatestHash(ref)
  if (!latestHash.has(key)) latestHash.set(key, latest)
  if (baseline && snapshotState(chapterContent(doc, ref.kind), latest).changed) await takeSnapshot(ref, doc)
  publish(ref, doc)
}

/** After each (debounced) store: a Snapshot once the document has been active for SNAPSHOT_AFTER_MS. */
export async function documentStored(ref: SnapshotDocument, doc: Document): Promise<void> {
  publish(ref, doc)
  const key = nameOf(ref)
  const since = activeSince.get(key)
  if (since === undefined) {
    activeSince.set(key, Date.now())
  } else if (Date.now() - since >= SNAPSHOT_AFTER_MS) {
    await takeSnapshot(ref, doc)
  }
}

/** The last connection left: snapshot whatever changed since the last Snapshot. */
export async function documentUnloading(ref: SnapshotDocument, doc: Document): Promise<void> {
  const key = nameOf(ref)
  try {
    if (activeSince.has(key)) await takeSnapshot(ref, doc)
  } finally {
    latestHash.delete(key)
    published.delete(key)
  }
}

/** The SnapshotMessage for a newly connected editor, once the document's state is known. */
export function snapshotMessage(ref: SnapshotDocument): string | undefined {
  return published.get(nameOf(ref))
}

/** Tells the document's connections if its SnapshotMessage changed. A no-op until its latest hash is known. */
function publish(ref: SnapshotDocument, doc: Document, content: ChapterContent = chapterContent(doc, ref.kind)) {
  const key = nameOf(ref)
  const latest = latestHash.get(key)
  if (latest === undefined) return
  const message = JSON.stringify({ type: "snapshot", ...snapshotState(content, latest) } satisfies SnapshotMessage)
  if (published.get(key) === message) return
  published.set(key, message)
  doc.broadcastStateless(message)
}

/**
 * Takes a named (or unnamed) Snapshot of the live document, loading it if nobody has it open.
 * "unchanged" when there's nothing new to save, "gone" if the document no longer exists or is in the Trash.
 */
export async function takeSnapshotNow<Context>(
  instance: Hocuspocus<Context>,
  ref: SnapshotDocument,
  name: string | null,
  context: (storyId: string) => Context
): Promise<"taken" | "unchanged" | "gone"> {
  const parent = sql("public." + TABLES[ref.kind].parent)
  const [row] = await sql<{ story_id: string }[]>`
    select story_id from ${parent} where id = ${ref.id} and deleted_at is null
  `
  if (!row) return "gone"

  const connection = await instance.openDirectConnection(nameOf(ref), context(row.story_id))
  try {
    const doc = connection.document!
    if (chapterContent(doc, ref.kind).textContent === "") return "unchanged"
    if (await takeSnapshot(ref, doc, name)) return "taken"
  } finally {
    await connection.disconnect()
  }
  const [still] = await sql`select 1 from ${parent} where id = ${ref.id} and deleted_at is null`
  return still ? "unchanged" : "gone"
}

/** A Snapshot's content as ProseMirror JSON, or null if it's gone. */
export async function snapshotPreview(kind: SnapshotKind, snapshotId: string): Promise<Record<string, unknown> | null> {
  const [row] = await sql<{ state: Uint8Array }[]>`
    select state from ${sql("public." + TABLES[kind].table)} where id = ${snapshotId}
  `
  return row ? decodeChapter(row.state, kind).toJSON() : null
}

/**
 * Replaces the live document's content with the Snapshot's, as one new change that open editors
 * receive like any other edit. The current text is snapshotted first, so a Restore can be undone by
 * restoring that. Returns false if the Snapshot is gone or its document is in the Trash.
 */
export async function restoreSnapshot<Context>(
  instance: Hocuspocus<Context>,
  kind: SnapshotKind,
  snapshotId: string,
  context: (id: string, storyId: string, kind: SnapshotKind) => Context
): Promise<boolean> {
  const { table, fk, parent } = TABLES[kind]
  const [row] = await sql<{ document_id: string; story_id: string; state: Uint8Array }[]>`
    select s.${sql(fk)} as document_id, d.story_id, s.state
    from ${sql("public." + table)} s
    join ${sql("public." + parent)} d on d.id = s.${sql(fk)}
    where s.id = ${snapshotId} and d.deleted_at is null
  `
  if (!row) return false
  const ref = { kind, id: row.document_id }
  const target = decodeChapter(row.state, kind)

  const connection = await instance.openDirectConnection(nameOf(ref), context(ref.id, row.story_id, kind))
  try {
    await takeSnapshot(ref, connection.document!, "Before Restore")
    await connection.transact((doc) => replaceChapterContent(doc, target))
  } finally {
    await connection.disconnect()
  }
  return true
}
