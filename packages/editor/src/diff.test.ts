import type { JSONContent } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { diffChapters, type DiffBlock } from "./diff"

type Text = string | { text: string; marks: JSONContent["marks"] }

function p(...texts: Text[]): JSONContent {
  return {
    type: "paragraph",
    content: texts.map((t) => (typeof t === "string" ? { type: "text", text: t } : { type: "text", ...t })),
  }
}

const hr: JSONContent = { type: "sceneBreak" }

function doc(...blocks: JSONContent[]): JSONContent {
  return { type: "doc", content: blocks }
}

const mia = { type: "author", attrs: { userId: "mia", at: 1 } }
const ben = { type: "author", attrs: { userId: "ben", at: 2 } }
const bold = { type: "bold" }

/** A block's segments as `text`, `[-removed-]` and `{+added+}`. */
function show(block: DiffBlock): string {
  return block.segments.map((s) => (s.op === "del" ? `[-${s.text}-]` : s.op === "ins" ? `{+${s.text}+}` : s.text)).join("")
}

describe("diffChapters", () => {
  it("finds nothing between identical Chapters", () => {
    const chapter = doc(p("The tide came in."), hr, p("Morning."))
    const diff = diffChapters(chapter, chapter)
    expect(diff.rows.map((r) => r.kind)).toEqual(["same", "same", "same"])
    expect(diff.additions).toBe(0)
    expect(diff.removals).toBe(0)
    expect(diff.right.map(show)).toEqual(["The tide came in.", "", "Morning."])
  })

  it("diffs a word changed mid-sentence", () => {
    const diff = diffChapters(doc(p("The quick fox ran.")), doc(p("The slow fox ran.")))
    expect(diff.rows).toEqual([{ kind: "changed", left: 0, right: 0 }])
    expect(show(diff.left[0]!)).toBe("The [-quick-] fox ran.")
    expect(show(diff.right[0]!)).toBe("The {+slow+} fox ran.")
    expect(diff.additions).toBe(1)
    expect(diff.removals).toBe(1)
  })

  it("aligns an added paragraph with a gap on the left", () => {
    const diff = diffChapters(doc(p("One."), p("Three.")), doc(p("One."), p("Two, new."), p("Three.")))
    expect(diff.rows).toEqual([
      { kind: "same", left: 0, right: 0 },
      { kind: "added", right: 1 },
      { kind: "same", left: 1, right: 2 },
    ])
    expect(show(diff.right[1]!)).toBe("{+Two, new.+}")
    expect(diff.additions).toBe(1)
  })

  it("aligns a removed paragraph with a gap on the right", () => {
    const diff = diffChapters(doc(p("One."), p("Two."), p("Three.")), doc(p("One."), p("Three.")))
    expect(diff.rows).toEqual([
      { kind: "same", left: 0, right: 0 },
      { kind: "removed", left: 1 },
      { kind: "same", left: 2, right: 1 },
    ])
    expect(show(diff.left[1]!)).toBe("[-Two.-]")
    expect(diff.removals).toBe(1)
  })

  it("pairs a rewritten paragraph by similarity, and leaves an unrelated one removed and added", () => {
    const diff = diffChapters(
      doc(p("She walked down to the harbour at dawn."), p("Gulls.")),
      doc(p("She walked slowly down to the harbour at dawn."), p("Nothing alike here at all."))
    )
    expect(diff.rows).toEqual([
      { kind: "changed", left: 0, right: 0 },
      { kind: "removed", left: 1 },
      { kind: "added", right: 1 },
    ])
    expect(show(diff.right[0]!)).toBe("She walked {+slowly +}down to the harbour at dawn.")
  })

  it("puts removed rows before added rows at the same spot", () => {
    const diff = diffChapters(doc(p("Alpha"), p("Old line.")), doc(p("Alpha"), p("Totally different words.")))
    expect(diff.rows.map((r) => r.kind)).toEqual(["same", "removed", "added"])
  })

  it("treats a Scene Break as a block", () => {
    const diff = diffChapters(doc(p("Before."), p("After.")), doc(p("Before."), hr, p("After.")))
    expect(diff.rows).toEqual([
      { kind: "same", left: 0, right: 0 },
      { kind: "added", right: 1 },
      { kind: "same", left: 1, right: 2 },
    ])
    expect(diff.right[1]).toEqual({ type: "sceneBreak", segments: [] })
    expect(diff.additions).toBe(1)
  })

  it("ignores mark-only changes", () => {
    const diff = diffChapters(
      doc(p({ text: "Bold move.", marks: [mia] })),
      doc(p({ text: "Bold", marks: [ben, bold] }, { text: " move.", marks: [ben] }))
    )
    expect(diff.rows).toEqual([{ kind: "same", left: 0, right: 0 }])
    expect(diff.additions + diff.removals).toBe(0)
    expect(diff.right[0]!.segments).toEqual([
      { text: "Bold", marks: [ben, bold], op: "same" },
      { text: " move.", marks: [ben], op: "same" },
    ])
  })

  it("keeps each text node's marks across split segments", () => {
    const diff = diffChapters(
      doc(p({ text: "The tide ", marks: [mia] }, { text: "came in fast", marks: [mia, bold] })),
      doc(p({ text: "The tide ", marks: [mia] }, { text: "came in ", marks: [mia, bold] }, { text: "slowly", marks: [ben] }))
    )
    expect(diff.left[0]!.segments).toEqual([
      { text: "The tide ", marks: [mia], op: "same" },
      { text: "came in ", marks: [mia, bold], op: "same" },
      { text: "fast", marks: [mia, bold], op: "del" },
    ])
    expect(diff.right[0]!.segments).toEqual([
      { text: "The tide ", marks: [mia], op: "same" },
      { text: "came in ", marks: [mia, bold], op: "same" },
      { text: "slowly", marks: [ben], op: "ins" },
    ])
  })

  it("handles empty Chapters", () => {
    expect(diffChapters(doc(), doc())).toEqual({ rows: [], left: [], right: [], additions: 0, removals: 0 })
    const diff = diffChapters(doc(p()), doc(p("First words.")))
    expect(diff.rows.map((r) => r.kind)).toEqual(["removed", "added"])
    expect(show(diff.right[0]!)).toBe("{+First words.+}")
  })
})
