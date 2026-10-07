import type * as Y from "yjs"
import { documentName, type DocumentKind } from "@coscribe/editor"
import { decideAccess, type Access, type AccessFacts } from "./access"
import { chapterContent, chapterStats, decodeChapter } from "./chapter-content"
import { sql } from "./db"

const TABLE: Record<DocumentKind, string> = { chapter: "chapters", entry: "entries" }

export type DocumentRef = { kind: DocumentKind; id: string }

/**
 * The document's story, what `userId` (null for anonymous) may do with it, and whether they're a member.
 * Null story if the document is gone. Entries have no lock, so only a Finished story makes them read-only.
 */
export async function documentAccess(
  doc: DocumentRef,
  userId: string | null
): Promise<{ storyId: string | null; access: Access; member: boolean }> {
  const locked = doc.kind === "chapter" ? sql`d.locked` : sql`false`
  const [row] = await sql<(AccessFacts & { story_id: string })[]>`
    select
      d.story_id,
      s.visibility,
      s.status,
      ${locked} as locked,
      m.role,
      exists (
        select 1 from public.invites i
        where i.story_id = s.id and i.invitee_id = ${userId} and i.used_at is null
      ) as invited
    from ${sql("public." + TABLE[doc.kind])} d
    join public.stories s on s.id = d.story_id
    left join public.story_members m on m.story_id = s.id and m.user_id = ${userId}
    where d.id = ${doc.id}
  `
  return { storyId: row?.story_id ?? null, access: decideAccess(row ?? null), member: !!row?.role }
}

export async function fetchDocument(doc: DocumentRef): Promise<Uint8Array | null> {
  const [row] = await sql<{ ydoc: Uint8Array | null }[]>`
    select ydoc from ${sql("public." + TABLE[doc.kind])} where id = ${doc.id}
  `
  return row?.ydoc ?? null
}

/** A no-op once the document is deleted. Chapters also get their stats, read from the live `document`. */
export async function storeDocument(doc: DocumentRef, state: Uint8Array, document: Y.Doc): Promise<void> {
  if (doc.kind === "entry") {
    await sql`update public.entries set ydoc = ${state} where id = ${doc.id}`
    return
  }
  const { words, authorChars } = chapterStats(chapterContent(document))
  await sql`
    update public.chapters
    set ydoc = ${state}, word_count = ${words}, author_chars = ${sql.json(authorChars)}, edited_at = now()
    where id = ${doc.id}
  `
}

/**
 * Fills stats for Chapters stored before they existed. Their last edit is unknown, so edited_at takes the
 * latest Snapshot (or creation) time. Skips any Chapter a live store reached first.
 */
export async function backfillChapterStats(): Promise<number> {
  const rows = await sql<{ id: string; ydoc: Uint8Array }[]>`
    select id, ydoc from public.chapters where edited_at is null and ydoc is not null
  `
  for (const { id, ydoc } of rows) {
    const { words, authorChars } = chapterStats(decodeChapter(ydoc))
    await sql`
      update public.chapters c
      set word_count = ${words},
          author_chars = ${sql.json(authorChars)},
          edited_at = greatest(c.created_at, (select max(taken_at) from public.chapter_snapshots where chapter_id = c.id))
      where c.id = ${id} and c.edited_at is null
    `
  }
  return rows.length
}

export type StoryContent = Record<DocumentKind, Record<string, Record<string, unknown>>>

/**
 * Every Chapter and Entry body in a story as ProseMirror JSON, keyed by id. Documents open in `loaded`
 * are read live, since storage lags edits by a debounce; the rest are decoded from storage.
 */
export async function storyContent(storyId: string, loaded: (name: string) => Y.Doc | undefined): Promise<StoryContent> {
  const rows = await sql<{ kind: DocumentKind; id: string; ydoc: Uint8Array | null }[]>`
    select 'chapter' as kind, id, ydoc from public.chapters where story_id = ${storyId}
    union all
    select 'entry' as kind, id, ydoc from public.entries where story_id = ${storyId}
  `
  const content: StoryContent = { chapter: {}, entry: {} }
  for (const { kind, id, ydoc } of rows) {
    const live = loaded(documentName(kind, id))
    const node = live ? chapterContent(live, kind) : ydoc ? decodeChapter(ydoc, kind) : null
    content[kind][id] = node?.toJSON() ?? { type: "doc" }
  }
  return content
}
