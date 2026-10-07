import { describe, expect, it, vi } from "vitest"
import { storyCounts, type Visit } from "./presence"

vi.mock("./db", () => ({ sql: {} }))

const visit = (patch: Partial<Visit>): Visit => ({
  storyId: "s1",
  userId: null,
  socketId: "sock",
  member: false,
  document: { kind: "chapter", id: "c1" },
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
})
