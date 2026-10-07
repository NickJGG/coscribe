import { decideAccess, type Access, type AccessFacts } from "./access"
import { sql } from "./db"

/** The Chapter's story and what `userId` (null for anonymous) may do with it. Null story if the Chapter is gone. */
export async function chapterAccess(
  chapterId: string,
  userId: string | null
): Promise<{ storyId: string | null; access: Access }> {
  const [row] = await sql<(AccessFacts & { story_id: string })[]>`
    select
      c.story_id,
      s.visibility,
      s.status,
      c.locked,
      m.role,
      exists (
        select 1 from public.invites i
        where i.story_id = s.id and i.invitee_id = ${userId} and i.used_at is null
      ) as invited
    from public.chapters c
    join public.stories s on s.id = c.story_id
    left join public.story_members m on m.story_id = s.id and m.user_id = ${userId}
    where c.id = ${chapterId}
  `
  return { storyId: row?.story_id ?? null, access: decideAccess(row ?? null) }
}

export async function fetchChapter(chapterId: string): Promise<Uint8Array | null> {
  const [row] = await sql<{ ydoc: Uint8Array | null }[]>`select ydoc from public.chapters where id = ${chapterId}`
  return row?.ydoc ?? null
}

/** A no-op once the Chapter is deleted. */
export async function storeChapter(chapterId: string, state: Uint8Array): Promise<void> {
  await sql`update public.chapters set ydoc = ${state} where id = ${chapterId}`
}
