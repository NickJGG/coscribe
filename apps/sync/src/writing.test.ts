import { beforeEach, describe, expect, it, vi } from "vitest"
import { flushWriting, noteEdit } from "./writing"

const sql = vi.hoisted(() => vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([])))
vi.mock("./db", () => ({ sql }))

const MINUTE = 60_000
const flushed = () =>
  sql.mock.calls.map(([, ...values]) => ({
    userId: values.find((v) => typeof v === "string"),
    minutes: values.find(Array.isArray),
  }))

describe("Writing Days", () => {
  beforeEach(async () => {
    await flushWriting()
    sql.mockClear()
  })

  it("counts each minute once per User", async () => {
    noteEdit("mia", 10 * MINUTE)
    noteEdit("mia", 10 * MINUTE + 59_000)
    noteEdit("mia", 11 * MINUTE)
    noteEdit("mia", 10 * MINUTE + 1)
    await flushWriting()
    expect(flushed()).toEqual([{ userId: "mia", minutes: [10, 11] }])
  })

  it("keeps two Users in the same minute apart", async () => {
    noteEdit("mia", 10 * MINUTE)
    noteEdit("theo", 10 * MINUTE)
    await flushWriting()
    expect(flushed()).toEqual([
      { userId: "mia", minutes: [10] },
      { userId: "theo", minutes: [10] },
    ])
  })

  it("empties the buffer after a flush", async () => {
    noteEdit("mia", 10 * MINUTE)
    await flushWriting()
    await flushWriting()
    expect(sql).toHaveBeenCalledTimes(1)
  })

  it("retries a failed flush on the next one", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {})
    sql.mockRejectedValueOnce(new Error("down"))
    noteEdit("mia", 10 * MINUTE)
    await flushWriting()
    noteEdit("mia", 12 * MINUTE)
    await flushWriting()
    expect(flushed()[1]).toEqual({ userId: "mia", minutes: [10, 12] })
  })
})
