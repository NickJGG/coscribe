import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { arrive, depart, storyCounts, type Visit } from "./presence"

const sql = vi.hoisted(() => vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([])))
vi.mock("./db", () => ({ sql }))

const visit = (patch: Partial<Visit>): Visit => ({
  storyId: "s1",
  userId: null,
  socketId: "sock",
  member: false,
  document: { kind: "chapter", id: "c1" },
  reference: false,
  ...patch,
})

describe("storyCounts", () => {
  it("counts each Writer once across documents and tabs", () => {
    const visits = [
      visit({ userId: "mia", member: true, socketId: "a" }),
      visit({ userId: "mia", member: true, socketId: "b", document: { kind: "entry", id: "e1" } }),
      visit({ userId: "jordan", member: true, socketId: "c" }),
    ]
    expect(storyCounts(visits, "s1")).toEqual({ writers: 2, viewers: 0 })
  })

  it("counts signed-in Viewers once and signed-out Viewers per browser", () => {
    const visits = [
      visit({ userId: "theo", socketId: "a" }),
      visit({ userId: "theo", socketId: "b" }),
      visit({ socketId: "c" }),
      visit({ socketId: "d" }),
      visit({ socketId: "d", document: { kind: "chapter", id: "c2" } }),
    ]
    expect(storyCounts(visits, "s1")).toEqual({ writers: 0, viewers: 3 })
  })

  it("ignores other Stories", () => {
    const visits = [visit({ userId: "mia", member: true }), visit({ storyId: "s2", socketId: "x" })]
    expect(storyCounts(visits, "s2")).toEqual({ writers: 0, viewers: 1 })
  })

  it("ignores reference visits", () => {
    const visits = [
      visit({ userId: "mia", member: true, reference: true, document: { kind: "entry", id: "e1" } }),
      visit({ userId: "theo", reference: true, socketId: "a", document: { kind: "entry", id: "e1" } }),
      visit({ userId: "jordan", member: true, socketId: "b" }),
    ]
    expect(storyCounts(visits, "s1")).toEqual({ writers: 1, viewers: 0 })
  })
})

describe("story_presence", () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve))
  const entry = { kind: "entry", id: "e1" } as const

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout"] })
    sql.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("records a Writer's visit", async () => {
    const key = {}
    arrive(key, visit({ userId: "mia", member: true, document: entry }))
    depart(key)
    await flush()
    expect(sql).toHaveBeenCalledTimes(2)
  })

  it("records nothing for a reference visit", async () => {
    const key = {}
    arrive(key, visit({ userId: "mia", member: true, reference: true, document: entry }))
    depart(key)
    await flush()
    expect(sql).not.toHaveBeenCalled()
  })

  it("clears a Writer's Presence when only a reference visit to the document is left", async () => {
    const page = {}
    const pinned = {}
    arrive(page, visit({ userId: "mia", member: true, socketId: "a", document: entry }))
    arrive(pinned, visit({ userId: "mia", member: true, socketId: "b", reference: true, document: entry }))
    depart(page)
    await flush()
    expect(sql).toHaveBeenCalledTimes(2)
    expect(sql.mock.calls[1]![0].join("")).toContain("delete from public.story_presence")
    depart(pinned)
  })
})
