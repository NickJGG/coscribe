import type { DocumentKind } from "@coscribe/editor"
import { decideAccess, type Access, type AccessFacts } from "./access"
import { sql } from "./db"

const TABLE: Record<DocumentKind, string> = { chapter: "chapters", entry: "entries" }

export type DocumentRef = { kind: DocumentKind; id: string }

/**
 * The document's story and what `userId` (null for anonymous) may do with it. Null story if the
 * document is gone. Entries have no lock, so only a Finished story makes them read-only.
 */
export async function documentAccess(
  doc: DocumentRef,
  userId: string | null
): Promise<{ storyId: string | null; access: Access }> {
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
  return { storyId: row?.story_id ?? null, access: decideAccess(row ?? null) }
}

export async function fetchDocument(doc: DocumentRef): Promise<Uint8Array | null> {
  const [row] = await sql<{ ydoc: Uint8Array | null }[]>`
    select ydoc from ${sql("public." + TABLE[doc.kind])} where id = ${doc.id}
  `
  return row?.ydoc ?? null
}

/** A no-op once the document is deleted. */
export async function storeDocument(doc: DocumentRef, state: Uint8Array): Promise<void> {
  await sql`update ${sql("public." + TABLE[doc.kind])} set ydoc = ${state} where id = ${doc.id}`
}
