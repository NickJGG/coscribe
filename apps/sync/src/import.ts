import type { Hocuspocus } from "@hocuspocus/server"
import type * as Y from "yjs"
import { documentName, type DocumentKind } from "@coscribe/editor"
import { replaceChapterContent, type ChapterContent } from "./chapter-content"
import { sql } from "./db"
import { writeOutline, type ImportBody } from "./import-body"
import type { DocumentRef } from "./documents"

/**
 * Fills a freshly created Story from an imported file: its default "Chapter 1" becomes the first Chapter, the rest
 * and the Entries are inserted (so no `chapter_added` notifications), then every document is seeded through a
 * direct connection, whose store sets the Chapters' stats. "refused" unless the Story is live, still being written,
 * Hosted by `body.userId`, and untouched since `create_story`.
 */
export async function importStory<Context>(
  instance: Hocuspocus<Context>,
  storyId: string,
  body: ImportBody,
  context: (document: DocumentRef, storyId: string) => Context
): Promise<"imported" | "refused"> {
  const created = await sql.begin(async (sql) => {
    const [story] = await sql<{ id: string }[]>`
      select s.id from public.stories s
      join public.story_members m on m.story_id = s.id and m.user_id = ${body.userId} and m.role = 'host'
      where s.id = ${storyId} and s.deleted_at is null and s.status = 'active'
      for update of s
    `
    const chapters = await sql<{ id: string; title: string; ydoc: Uint8Array | null }[]>`
      select id, title, ydoc from public.chapters where story_id = ${storyId}
    `
    const [row] = await sql<{ touched: boolean }[]>`
      select exists (select 1 from public.entries where story_id = ${storyId})
        or exists (select 1 from public.chapter_outlines where story_id = ${storyId}) as touched
    `
    const first = chapters[0]
    if (!story || chapters.length !== 1 || first!.title !== "Chapter 1" || first!.ydoc || row!.touched) return null

    const [head, ...rest] = body.chapters
    await sql`update public.chapters set title = ${head!.title} where id = ${first!.id}`
    const added = rest.length
      ? await sql<{ id: string; position: number }[]>`
          insert into public.chapters ${sql(rest.map((c, i) => ({ story_id: storyId, position: i + 2, title: c.title })))}
          returning id, position
        `
      : []
    const chapterIds = [first!.id, ...added.toSorted((a, b) => a.position - b.position).map((c) => c.id)]

    // One at a time, so place_entry numbers each type in file order.
    const entryIds: string[] = []
    for (const e of body.entries) {
      const [row] = await sql<{ id: string }[]>`
        insert into public.entries (story_id, type, name, description, aliases, created_by)
        values (${storyId}, ${e.type}, ${e.name}, ${e.description}, ${e.aliases}, ${body.userId})
        returning id
      `
      entryIds.push(row!.id)
    }
    return { chapterIds, entryIds }
  })
  if (!created) return "refused"

  const seed = async (kind: DocumentKind, id: string, write: (doc: Y.Doc) => void) => {
    const connection = await instance.openDirectConnection(documentName(kind, id), context({ kind, id }, storyId))
    try {
      await connection.transact(write)
    } finally {
      await connection.disconnect()
    }
  }
  const replace = (content: ChapterContent) => (doc: Y.Doc) => replaceChapterContent(doc, content)

  const characterIds = new Map(
    body.entries.flatMap((e, i) => (e.type === "character" ? [[e.name.toLowerCase(), created.entryIds[i]!] as const] : []))
  )
  for (const [i, chapter] of body.chapters.entries()) {
    const id = created.chapterIds[i]!
    await seed("chapter", id, replace(chapter.content))
    const outline = chapter.outline
    if (outline) await seed("outline", id, (doc) => writeOutline(doc, outline, characterIds))
  }
  for (const [i, entry] of body.entries.entries()) await seed("entry", created.entryIds[i]!, replace(entry.body))
  return "imported"
}
