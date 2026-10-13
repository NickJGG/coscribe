import type * as Y from "yjs"
import { documentName, outlineHasContent, stripNoteMarks, type DocumentKind } from "@coscribe/editor"
import { decideAccess, type Access, type AccessFacts } from "./access"
import { chapterContent, chapterStats, decodeChapter } from "./chapter-content"
import { sql } from "./db"

/** Where each kind's story and lock live. An Outline's id is its Chapter's. */
const TABLE: Record<DocumentKind, string> = { chapter: "chapters", entry: "entries", outline: "chapters" }

export type DocumentRef = { kind: DocumentKind; id: string }

/**
 * The document's story, what `userId` (null for anonymous) may do with it, and whether they're a Writer or up.
 * Null story if the document is gone. Entries have no lock, so only a Finished story makes them read-only.
 * Outlines go by their Chapter.
 */
export async function documentAccess(
  doc: DocumentRef,
  userId: string | null
): Promise<{ storyId: string | null; access: Access; member: boolean }> {
  const locked = doc.kind === "entry" ? sql`false` : sql`d.locked`
  const [row] = await sql<(Omit<AccessFacts, "kind"> & { story_id: string })[]>`
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
  const access = decideAccess(row ? { ...row, kind: doc.kind } : null)
  return { storyId: row?.story_id ?? null, access, member: !!row?.role && row.role !== "viewer" }
}

export async function fetchDocument(doc: DocumentRef): Promise<Uint8Array | null> {
  if (doc.kind === "outline") {
    const [row] = await sql<{ ydoc: Uint8Array | null }[]>`
      select ydoc from public.chapter_outlines where chapter_id = ${doc.id}
    `
    return row?.ydoc ?? null
  }
  const [row] = await sql<{ ydoc: Uint8Array | null }[]>`
    select ydoc from ${sql("public." + TABLE[doc.kind])} where id = ${doc.id}
  `
  return row?.ydoc ?? null
}

/**
 * A no-op once the document (or an Outline's Chapter) is deleted. Chapters also get their stats, read from
 * the live `document`. An Outline's row is created on its first store.
 */
export async function storeDocument(doc: DocumentRef, state: Uint8Array, document: Y.Doc): Promise<void> {
  if (doc.kind === "outline") {
    await sql`
      insert into public.chapter_outlines (chapter_id, story_id, ydoc, has_content)
      select id, story_id, ${state}, ${outlineHasContent(document)} from public.chapters where id = ${doc.id}
      on conflict (chapter_id) do update
      set ydoc = excluded.ydoc, has_content = excluded.has_content, updated_at = now()
    `
    return
  }
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

type ContentKind = "chapter" | "entry"

export type StoryContent = Record<ContentKind, Record<string, Record<string, unknown>>>

/**
 * Every Chapter and Entry body in a story as ProseMirror JSON, keyed by id. Documents open in `loaded`
 * are read live, since storage lags edits by a debounce; the rest are decoded from storage. Note marks
 * are stripped: this feeds the public Reader View.
 */
export async function storyContent(storyId: string, loaded: (name: string) => Y.Doc | undefined): Promise<StoryContent> {
  const rows = await sql<{ kind: ContentKind; id: string; ydoc: Uint8Array | null }[]>`
    select 'chapter' as kind, id, ydoc from public.chapters where story_id = ${storyId}
    union all
    select 'entry' as kind, id, ydoc from public.entries where story_id = ${storyId}
  `
  const content: StoryContent = { chapter: {}, entry: {} }
  for (const { kind, id, ydoc } of rows) {
    const live = loaded(documentName(kind, id))
    const node = live ? chapterContent(live, kind) : ydoc ? decodeChapter(ydoc, kind) : null
    content[kind][id] = node ? stripNoteMarks(node.toJSON()) : { type: "doc" }
  }
  return content
}
