/**
 * Chapter Snapshots: the full Yjs state, taken after about 10 minutes of activity and when the last
 * connection leaves, skipped when the text (author marks included) matches the latest one.
 * Previews and Restores go through ProseMirror content, so `author` marks come back with the text.
 */
import type { Hocuspocus } from "@hocuspocus/server"
import * as Y from "yjs"
import { documentName } from "@coscribe/editor"
import { chapterContent, contentHash, decodeChapter, replaceChapterContent } from "./chapter-content"
import { sql } from "./db"

export const SNAPSHOT_AFTER_MS = 10 * 60_000

/** Chapter id → when its first change since the last Snapshot was stored. */
const activeSince = new Map<string, number>()

export async function takeSnapshot(chapterId: string, doc: Y.Doc, name: string | null = null): Promise<void> {
  activeSince.delete(chapterId)
  const content = chapterContent(doc)
  const hash = contentHash(content)
  const [latest] = await sql<{ content_hash: string }[]>`
    select content_hash from public.chapter_snapshots
    where chapter_id = ${chapterId}
    order by taken_at desc
    limit 1
  `
  if (latest ? latest.content_hash === hash : content.textContent === "") return

  // A no-op if the Chapter was deleted meanwhile.
  await sql`
    insert into public.chapter_snapshots (chapter_id, state, content_hash, name)
    select ${chapterId}, ${Y.encodeStateAsUpdate(doc)}, ${hash}, ${name}
    where exists (select 1 from public.chapters where id = ${chapterId})
  `
}

/** After each (debounced) store: a Snapshot once the Chapter has been active for SNAPSHOT_AFTER_MS. */
export async function chapterStored(chapterId: string, doc: Y.Doc): Promise<void> {
  const since = activeSince.get(chapterId)
  if (since === undefined) {
    activeSince.set(chapterId, Date.now())
  } else if (Date.now() - since >= SNAPSHOT_AFTER_MS) {
    await takeSnapshot(chapterId, doc)
  }
}

/** The last connection left: snapshot whatever changed since the last Snapshot. */
export async function chapterUnloading(chapterId: string, doc: Y.Doc): Promise<void> {
  if (activeSince.has(chapterId)) await takeSnapshot(chapterId, doc)
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
