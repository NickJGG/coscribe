/**
 * Chapter Snapshots: the full Yjs state, taken after about 10 minutes of activity, when the last
 * connection leaves, and on demand by a Co-host. Skipped when the text (author marks included)
 * matches the latest one. Previews and Restores go through ProseMirror content, so `author` marks
 * come back with the text.
 *
 * Open Chapters track whether taking a Snapshot would save anything, and tell their connections
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

/** Chapter id → when its first change since the last Snapshot was stored. */
const activeSince = new Map<string, number>()

/** Open Chapter id → its latest Snapshot's content_hash (null: none yet). */
const latestHash = new Map<string, string | null>()

/** Open Chapter id → the SnapshotMessage last sent to its connections. */
const published = new Map<string, string>()

/** Returns whether a Snapshot was taken. */
export async function takeSnapshot(chapterId: string, doc: Document, name: string | null = null): Promise<boolean> {
  activeSince.delete(chapterId)
  const content = chapterContent(doc)
  const hash = contentHash(content)
  const latest = await fetchLatestHash(chapterId)
  if (latest ? latest === hash : content.textContent === "") return false

  // A no-op if the Chapter was deleted meanwhile.
  const inserted = await sql`
    insert into public.chapter_snapshots (chapter_id, state, content_hash, name)
    select ${chapterId}, ${Y.encodeStateAsUpdate(doc)}, ${hash}, ${name}
    where exists (select 1 from public.chapters where id = ${chapterId})
  `
  if (inserted.count === 0) return false
  if (latestHash.has(chapterId)) {
    latestHash.set(chapterId, hash)
    publish(chapterId, doc, content)
  }
  return true
}

async function fetchLatestHash(chapterId: string): Promise<string | null> {
  const [latest] = await sql<{ content_hash: string }[]>`
    select content_hash from public.chapter_snapshots
    where chapter_id = ${chapterId}
    order by taken_at desc
    limit 1
  `
  return latest?.content_hash ?? null
}

export async function chapterLoaded(chapterId: string, doc: Document): Promise<void> {
  const latest = await fetchLatestHash(chapterId)
  if (!latestHash.has(chapterId)) latestHash.set(chapterId, latest)
  publish(chapterId, doc)
}

/** After each (debounced) store: a Snapshot once the Chapter has been active for SNAPSHOT_AFTER_MS. */
export async function chapterStored(chapterId: string, doc: Document): Promise<void> {
  publish(chapterId, doc)
  const since = activeSince.get(chapterId)
  if (since === undefined) {
    activeSince.set(chapterId, Date.now())
  } else if (Date.now() - since >= SNAPSHOT_AFTER_MS) {
    await takeSnapshot(chapterId, doc)
  }
}

/** The last connection left: snapshot whatever changed since the last Snapshot. */
export async function chapterUnloading(chapterId: string, doc: Document): Promise<void> {
  try {
    if (activeSince.has(chapterId)) await takeSnapshot(chapterId, doc)
  } finally {
    latestHash.delete(chapterId)
    published.delete(chapterId)
  }
}

/** The SnapshotMessage for a newly connected editor, once the Chapter's state is known. */
export function snapshotMessage(chapterId: string): string | undefined {
  return published.get(chapterId)
}

/** Tells the Chapter's connections if its SnapshotMessage changed. A no-op until its latest hash is known. */
function publish(chapterId: string, doc: Document, content: ChapterContent = chapterContent(doc)) {
  const latest = latestHash.get(chapterId)
  if (latest === undefined) return
  const message = JSON.stringify({ type: "snapshot", ...snapshotState(content, latest) } satisfies SnapshotMessage)
  if (published.get(chapterId) === message) return
  published.set(chapterId, message)
  doc.broadcastStateless(message)
}

/**
 * Takes a named (or unnamed) Snapshot of the live Chapter, loading it if nobody has it open.
 * "unchanged" when there's nothing new to save, "gone" if the Chapter no longer exists.
 */
export async function takeSnapshotNow<Context>(
  instance: Hocuspocus<Context>,
  chapterId: string,
  name: string | null,
  context: (storyId: string) => Context
): Promise<"taken" | "unchanged" | "gone"> {
  const [row] = await sql<{ story_id: string }[]>`select story_id from public.chapters where id = ${chapterId}`
  if (!row) return "gone"

  const connection = await instance.openDirectConnection(documentName("chapter", chapterId), context(row.story_id))
  try {
    const doc = connection.document!
    if (chapterContent(doc).textContent === "") return "unchanged"
    if (await takeSnapshot(chapterId, doc, name)) return "taken"
  } finally {
    await connection.disconnect()
  }
  const [still] = await sql`select 1 from public.chapters where id = ${chapterId}`
  return still ? "unchanged" : "gone"
}

/** A Snapshot's content as ProseMirror JSON, or null if it's gone. */
export async function snapshotPreview(snapshotId: string): Promise<Record<string, unknown> | null> {
  const [row] = await sql<{ state: Uint8Array }[]>`
    select state from public.chapter_snapshots where id = ${snapshotId}
  `
  return row ? decodeChapter(row.state).toJSON() : null
}

/**
 * Replaces the live Chapter's content with the Snapshot's, as one new change that open editors
 * receive like any other edit. The current text is snapshotted first, so a Restore can be undone by
 * restoring that. Returns false if the Snapshot is gone.
 */
export async function restoreSnapshot<Context>(
  instance: Hocuspocus<Context>,
  snapshotId: string,
  context: (chapterId: string, storyId: string) => Context
): Promise<boolean> {
  const [row] = await sql<{ chapter_id: string; story_id: string; state: Uint8Array }[]>`
    select s.chapter_id, c.story_id, s.state
    from public.chapter_snapshots s
    join public.chapters c on c.id = s.chapter_id
    where s.id = ${snapshotId}
  `
  if (!row) return false
  const target = decodeChapter(row.state)

  const connection = await instance.openDirectConnection(
    documentName("chapter", row.chapter_id),
    context(row.chapter_id, row.story_id)
  )
  try {
    await takeSnapshot(row.chapter_id, connection.document!, "Before Restore")
    await connection.transact((doc) => replaceChapterContent(doc, target))
  } finally {
    await connection.disconnect()
  }
  return true
}
