import type * as Y from "yjs"
import { documentName, featureError, sliceChapter, stripNoteMarks, type TextPoint } from "@coscribe/editor"
import { chapterContent, decodeChapter } from "./chapter-content"
import { sql } from "./db"

// Under the table's check on jsonb text, which spaces out what JSON.stringify packs tight.
const MAX_BYTES = 32_768

export type FeatureResult = { saved: true } | { saved: false; gone: true } | { saved: false; error: string }

/**
 * Saves `userId`'s Featured Passage: a copy of the Chapter's text between two points, read live if the
 * Chapter is open. The web app checks the Story is Finished and the User is a member.
 */
export async function featurePassage(
  chapterId: string,
  userId: string,
  from: TextPoint,
  to: TextPoint,
  loaded: (name: string) => Y.Doc | undefined
): Promise<FeatureResult> {
  const [row] = await sql<{ story_id: string; ydoc: Uint8Array | null }[]>`
    select story_id, ydoc from public.chapters where id = ${chapterId}
  `
  if (!row) return { saved: false, gone: true }

  const live = loaded(documentName("chapter", chapterId))
  const node = live ? chapterContent(live) : row.ydoc ? decodeChapter(row.ydoc) : null
  const slice = sliceChapter(node ? stripNoteMarks(node.toJSON()) : { type: "doc" }, from, to)
  const error = featureError(slice, userId)
  if (error) return { saved: false, error }
  if (Buffer.byteLength(JSON.stringify(slice)) > MAX_BYTES) {
    return { saved: false, error: "Too long to feature. Keep it under 500 characters." }
  }

  await sql`
    insert into public.featured_passages (user_id, story_id, chapter_id, content)
    values (${userId}, ${row.story_id}, ${chapterId}, ${sql.json(slice)})
    on conflict (user_id) do update
    set story_id = excluded.story_id, chapter_id = excluded.chapter_id, content = excluded.content, created_at = now()
  `
  return { saved: true }
}

export function isTextPoint(value: unknown): value is TextPoint {
  const point = value as TextPoint | null
  return (
    typeof point === "object" &&
    point !== null &&
    Number.isInteger(point.block) &&
    Number.isInteger(point.offset) &&
    point.block >= 0 &&
    point.offset >= 0
  )
}
