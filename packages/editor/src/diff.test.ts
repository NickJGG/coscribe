import type { JSONContent } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { diffChapters, foldRows, type DiffBlock, type DiffRow, type DiffSegment } from "./diff"

type Text = string | { text: string; marks: JSONContent["marks"] }

function p(...texts: Text[]): JSONContent {
  return {
    type: "paragraph",
    content: texts.map((t) => (typeof t === "string" ? { type: "text", text: t } : { type: "text", ...t })),
  }
}

const hr: JSONContent = { type: "sceneBreak" }

function quote(...paragraphs: JSONContent[]): JSONContent {
  return { type: "blockquote", content: paragraphs }
}

function aligned(textAlign: string, paragraph: JSONContent): JSONContent {
  return { ...paragraph, attrs: { textAlign } }
}

function doc(...blocks: JSONContent[]): JSONContent {
  return { type: "doc", content: blocks }
}

const mia = { type: "author", attrs: { userId: "mia", at: 1 } }
const ben = { type: "author", attrs: { userId: "ben", at: 2 } }
const bold = { type: "bold" }
const strike = { type: "strike" }

/** Segments as `text`, `[-removed-]` and `{+added+}`. */
function showSegments(segments: DiffSegment[]): string {
  return segments.map((s) => (s.op === "del" ? `[-${s.text}-]` : s.op === "ins" ? `{+${s.text}+}` : s.text)).join("")
}

function show(block: DiffBlock): string {
  return showSegments(block.segments)
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
    expect(diff.rows).toMatchObject([{ kind: "changed", left: 0, right: 0 }])
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
    expect(diff.rows).toMatchObject([
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

  it("flattens a block quote into rows of its paragraphs", () => {
    const chapter = doc(p("Before."), quote(p("Dear Ann,"), p("Come home.")), hr)
    const diff = diffChapters(chapter, chapter)
    expect(diff.rows.map((r) => r.kind)).toEqual(["same", "same", "same", "same"])
    expect(diff.right.map((block) => [show(block), block.quoted])).toEqual([
      ["Before.", undefined],
      ["Dear Ann,", true],
      ["Come home.", true],
      ["", undefined],
    ])
  })

  it("doesn't count quoting, alignment or strikethrough alone as a difference", () => {
    const diff = diffChapters(
      doc(p("Dear Ann,"), p("The End"), p("Struck.")),
      doc(quote(p("Dear Ann,")), aligned("center", p("The End")), p({ text: "Struck.", marks: [strike] }))
    )
    expect(diff.rows.map((r) => r.kind)).toEqual(["same", "same", "same"])
    expect(diff.additions + diff.removals).toBe(0)
    expect(diff.left[0]!.quoted).toBeUndefined()
    expect(diff.right[0]!.quoted).toBe(true)
    expect(diff.right[1]!.align).toBe("center")
    expect(diff.right[2]!.segments).toEqual([{ text: "Struck.", marks: [strike], op: "same" }])
  })

  it("keeps each side's look on a changed row", () => {
    const diff = diffChapters(
      doc(aligned("right", p("Yours, Ann"))),
      doc(quote(aligned("center", p("Yours ever, Ann"))))
    )
    expect(diff.rows).toMatchObject([{ kind: "changed", left: 0, right: 0 }])
    expect(diff.left[0]).toMatchObject({ align: "right" })
    expect(diff.left[0]!.quoted).toBeUndefined()
    expect(diff.right[0]).toMatchObject({ align: "center", quoted: true })
  })

  it("handles empty Chapters", () => {
    expect(diffChapters(doc(), doc())).toEqual({ rows: [], left: [], right: [], additions: 0, removals: 0 })
    const diff = diffChapters(doc(p()), doc(p("First words.")))
    expect(diff.rows.map((r) => r.kind)).toEqual(["removed", "added"])
    expect(show(diff.right[0]!)).toBe("{+First words.+}")
  })

  it("interleaves both sides of a changed row in reading order", () => {
    const diff = diffChapters(
      doc(p({ text: "The quick fox ", marks: [mia] }, { text: "ran.", marks: [mia, bold] })),
      doc(p({ text: "The ", marks: [ben] }, { text: "slow fox ran.", marks: [mia] }))
    )
    const row = diff.rows[0]!
    expect(row.kind).toBe("changed")
    const merged = row.kind === "changed" ? row.merged : []
    expect(showSegments(merged)).toBe("The [-quick-]{+slow+} fox ran.")
    expect(merged[0]).toEqual({ text: "The ", marks: [ben], op: "same" })
    expect(merged[1]).toEqual({ text: "quick", marks: [mia], op: "del" })
    expect(merged.at(-1)).toEqual({ text: " fox ran.", marks: [mia], op: "same" })
  })
})

describe("foldRows", () => {
  const same = (n: number): DiffRow => ({ kind: "same", left: n, right: n })
  const added = (n: number): DiffRow => ({ kind: "added", right: n })

  it("folds every row when nothing changed", () => {
    expect(foldRows([same(0), same(1), same(2)])).toEqual([{ kind: "fold", from: 0, to: 3 }])
  })

  it("keeps one row of context on each side of a change", () => {
    const rows = [same(0), same(1), same(2), added(3), same(3), same(4), same(5)]
    expect(foldRows(rows)).toEqual([
      { kind: "fold", from: 0, to: 2 },
      { kind: "row", row: 2 },
      { kind: "row", row: 3 },
      { kind: "row", row: 4 },
      { kind: "fold", from: 5, to: 7 },
    ])
  })

  it("folds the unchanged run between two changes, and leaves out folds at the edges", () => {
    const rows = [added(0), same(0), same(1), same(2), same(3), added(5)]
    expect(foldRows(rows)).toEqual([
      { kind: "row", row: 0 },
      { kind: "row", row: 1 },
      { kind: "fold", from: 2, to: 4 },
      { kind: "row", row: 4 },
      { kind: "row", row: 5 },
    ])
  })

  it("merges context that touches into one shown run", () => {
    const rows = [added(0), same(0), same(1), added(3)]
    expect(foldRows(rows).every((item) => item.kind === "row")).toBe(true)
  })

  it("takes a wider context", () => {
    const rows = [same(0), same(1), same(2), added(3)]
    expect(foldRows(rows, 2)).toEqual([
      { kind: "fold", from: 0, to: 1 },
      { kind: "row", row: 1 },
      { kind: "row", row: 2 },
      { kind: "row", row: 3 },
    ])
  })

  it("handles no rows", () => {
    expect(foldRows([])).toEqual([])
  })
})
