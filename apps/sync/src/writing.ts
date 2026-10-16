/**
 * Records Writing Days: the distinct minutes each User sent an edit in, buffered here and added to
 * `writing_days` once a minute, grouped by day in the User's own time zone. `writing_marks` holds the
 * latest minute already counted per User, so a retried or overlapping flush can drop minutes but never
 * count one twice. Flushes run one at a time.
 */
import { sql } from "./db"

const FLUSH_MS = 60_000

let pending = new Map<string, Set<number>>()
let flushing = Promise.resolve()

function note(userId: string, minute: number) {
  let minutes = pending.get(userId)
  if (!minutes) pending.set(userId, (minutes = new Set()))
  minutes.add(minute)
}

export function noteEdit(userId: string, at = Date.now()) {
  note(userId, Math.floor(at / 60_000))
}

export function flushWriting(): Promise<void> {
  flushing = flushing.then(flushOnce)
  return flushing
}

async function flushOnce() {
  const batch = pending
  pending = new Map()
  await Promise.all(
    [...batch].map(async ([userId, minutes]) => {
      try {
        await flushUser(userId, [...minutes])
      } catch (error) {
        console.error("writing flush failed", error)
        for (const minute of minutes) note(userId, minute)
      }
    })
  )
}

/** A deleted account's minutes join no profile, so they're dropped instead of failing every flush. */
function flushUser(userId: string, minutes: number[]) {
  return sql`
    with fresh as (
      select to_timestamp(m * 60) as at, coalesce(z.name, 'UTC') as zone
      from unnest(${minutes}::bigint[]) m
      join public.profiles p on p.id = ${userId}
      left join pg_catalog.pg_timezone_names z on z.name = p.time_zone
      where to_timestamp(m * 60) > coalesce(
        (select last_minute from public.writing_marks where user_id = ${userId}),
        '-infinity'
      )
    ),
    mark as (
      insert into public.writing_marks (user_id, last_minute)
      select ${userId}, max(at) from fresh having count(*) > 0
      on conflict (user_id) do update set last_minute = greatest(writing_marks.last_minute, excluded.last_minute)
    )
    insert into public.writing_days (user_id, day, minutes)
    select ${userId}, (at at time zone zone)::date, count(*) from fresh group by 2
    on conflict (user_id, day) do update set minutes = writing_days.minutes + excluded.minutes
  `
}

/** Returns a stop function that flushes whatever is left. */
export function startWritingFlush(): () => Promise<void> {
  const timer = setInterval(() => void flushWriting(), FLUSH_MS)
  return () => {
    clearInterval(timer)
    return flushWriting()
  }
}
