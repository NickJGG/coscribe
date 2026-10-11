/**
 * Mirrors open connections into `story_presence` (Writers, by name) and `story_activity` (counts).
 * Keyed by the connection's context object, which Hocuspocus passes unchanged to every hook. Writes run
 * one at a time, so the tables always end up matching what's in memory. Reference visits (a Pinned
 * Entry's body beside a Chapter) are tracked but never show up in either table.
 */
import { sql } from "./db"
import type { DocumentRef } from "./documents"

/** One open connection to a document. Members are Writers whether or not they can edit it right now. */
export type Visit = {
  storyId: string
  userId: string | null
  socketId: string
  member: boolean
  document: DocumentRef
  reference: boolean
}

const COUNT_DELAY_MS = 2000

/** Writers are people; Viewers are browsers, since a signed-out Viewer has nothing else to go by. */
export function storyCounts(visits: Iterable<Visit>, storyId: string): { writers: number; viewers: number } {
  const writers = new Set<string>()
  const viewers = new Set<string>()
  for (const visit of visits) {
    if (visit.storyId !== storyId || visit.reference) continue
    if (visit.member && visit.userId) writers.add(visit.userId)
    else viewers.add(visit.userId ?? visit.socketId)
  }
  return { writers: writers.size, viewers: viewers.size }
}

const visits = new Map<object, Visit>()
const uncounted = new Set<string>()
let writes = Promise.resolve()
let countTimer: NodeJS.Timeout | null = null

function write(task: () => Promise<unknown>) {
  writes = writes.then(task).then(
    () => {},
    (error) => console.error("presence write failed", error)
  )
}

export function arrive(key: object, visit: Visit) {
  visits.set(key, visit)
  if (visit.reference) return
  if (visit.member && visit.userId) {
    const { userId, storyId, document } = visit
    write(
      () => sql`
        insert into public.story_presence (user_id, story_id, kind, document_id)
        values (${userId}, ${storyId}, ${document.kind}, ${document.id})
        on conflict (user_id, document_id) do nothing
      `
    )
  }
  countLater(visit.storyId)
}

export function depart(key: object) {
  const visit = visits.get(key)
  if (!visit) return
  visits.delete(key)
  if (visit.reference) return
  const { userId, document } = visit
  const stillThere = [...visits.values()].some(
    (v) => v.member && !v.reference && v.userId === userId && v.document.id === document.id
  )
  if (visit.member && userId && !stillThere) {
    write(() => sql`delete from public.story_presence where user_id = ${userId} and document_id = ${document.id}`)
  }
  countLater(visit.storyId)
}

/** After an access change: someone who joined while watching becomes a Writer, and the reverse. */
export function setMember(key: object, member: boolean) {
  const visit = visits.get(key)
  if (!visit || visit.member === member) return
  depart(key)
  arrive(key, { ...visit, member })
}

function countLater(storyId: string) {
  uncounted.add(storyId)
  countTimer ??= setTimeout(() => {
    countTimer = null
    for (const id of uncounted) {
      const { writers, viewers } = storyCounts(visits.values(), id)
      write(() =>
        writers || viewers
          ? sql`
              insert into public.story_activity (story_id, writers, viewers)
              values (${id}, ${writers}, ${viewers})
              on conflict (story_id) do update
              set writers = excluded.writers, viewers = excluded.viewers, updated_at = now()
            `
          : sql`delete from public.story_activity where story_id = ${id}`
      )
    }
    uncounted.clear()
  }, COUNT_DELAY_MS)
}

/** Rows left by a server that stopped without closing its connections. */
export async function clearPresence() {
  await sql`delete from public.story_presence`
  await sql`delete from public.story_activity`
}
