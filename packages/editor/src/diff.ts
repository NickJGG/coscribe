import type { JSONContent } from "@tiptap/core"
import { diffArrays, diffWordsWithSpace } from "diff"

export type DiffOp = "same" | "del" | "ins"

/** A piece of one text node, with that node's own marks. */
export type DiffSegment = { text: string; marks?: JSONContent["marks"]; op: DiffOp }

/** A top-level block of one side, cut into segments. A Scene Break has none. */
export type DiffBlock = { type: "paragraph" | "sceneBreak"; segments: DiffSegment[] }

/** One aligned row: a block index on each side it has a block on. */
export type DiffRow =
  | { kind: "same" | "changed"; left: number; right: number }
  | { kind: "removed"; left: number; right?: never }
  | { kind: "added"; right: number; left?: never }

export type ChapterDiff = {
  rows: DiffRow[]
  left: DiffBlock[]
  right: DiffBlock[]
  additions: number
  removals: number
}

/** Paired as one rewritten paragraph when this share of the longer one's characters survives. */
const PAIR_SIMILARITY = 0.5
const SCENE_BREAK_KEY = "\u0000sceneBreak"

type Run = { text: string; marks?: JSONContent["marks"] }
type Block = { type: DiffBlock["type"]; runs: Run[]; text: string; key: string }
type Range = { length: number; op: DiffOp }

function blocksOf(doc: JSONContent): Block[] {
  return (doc.content ?? []).map((node) => {
    if (node.type === "sceneBreak") return { type: "sceneBreak", runs: [], text: "", key: SCENE_BREAK_KEY }
    const runs = (node.content ?? []).flatMap((n) => (n.type === "text" && n.text ? [{ text: n.text, marks: n.marks }] : []))
    const text = runs.map((r) => r.text).join("")
    return { type: "paragraph", runs, text, key: text }
  })
}

function similarity(a: Block, b: Block): number {
  if (a.type !== "paragraph" || b.type !== "paragraph") return 0
  const longer = Math.max(a.text.length, b.text.length)
  if (!longer) return 0
  let shared = 0
  for (const part of diffWordsWithSpace(a.text, b.text)) if (!part.added && !part.removed) shared += part.value.length
  return shared / longer
}

/** Cuts `runs` at the range boundaries, so every segment keeps the marks of the node it came from. */
function segment(runs: Run[], ranges: Range[]): DiffSegment[] {
  const out: DiffSegment[] = []
  let r = 0
  let used = 0
  for (const range of ranges) {
    let left = range.length
    while (left > 0 && r < runs.length) {
      const run = runs[r]!
      const take = Math.min(left, run.text.length - used)
      out.push({ text: run.text.slice(used, used + take), marks: run.marks, op: range.op })
      used += take
      left -= take
      if (used === run.text.length) {
        r++
        used = 0
      }
    }
  }
  return out
}

function whole(block: Block, op: DiffOp): DiffBlock {
  return { type: block.type, segments: block.runs.map((run) => ({ ...run, op })) }
}

function changeRuns(ranges: Range[], op: DiffOp): number {
  return ranges.filter((range, i) => range.op === op && ranges[i - 1]?.op !== op).length
}

/**
 * What changed from `left` to `right`, two Chapters' ProseMirror JSON. Top-level blocks are aligned
 * first (equal text anchors, then leftover paragraphs paired by word similarity), then words are diffed
 * inside each pair. Only text counts: bold, italic, `author` and `note` changes are not differences,
 * and each side's segments keep that side's own marks.
 */
export function diffChapters(left: JSONContent, right: JSONContent): ChapterDiff {
  const a = blocksOf(left)
  const b = blocksOf(right)
  const diff: ChapterDiff = {
    rows: [],
    left: a.map((block) => whole(block, "same")),
    right: b.map((block) => whole(block, "same")),
    additions: 0,
    removals: 0,
  }

  const removed = (i: number) => {
    diff.rows.push({ kind: "removed", left: i })
    diff.left[i] = whole(a[i]!, "del")
    diff.removals++
  }
  const added = (j: number) => {
    diff.rows.push({ kind: "added", right: j })
    diff.right[j] = whole(b[j]!, "ins")
    diff.additions++
  }
  const changed = (i: number, j: number) => {
    const leftRanges: Range[] = []
    const rightRanges: Range[] = []
    for (const part of diffWordsWithSpace(a[i]!.text, b[j]!.text)) {
      const length = part.value.length
      if (!part.added) leftRanges.push({ length, op: part.removed ? "del" : "same" })
      if (!part.removed) rightRanges.push({ length, op: part.added ? "ins" : "same" })
    }
    diff.rows.push({ kind: "changed", left: i, right: j })
    diff.left[i] = { type: "paragraph", segments: segment(a[i]!.runs, leftRanges) }
    diff.right[j] = { type: "paragraph", segments: segment(b[j]!.runs, rightRanges) }
    diff.removals += changeRuns(leftRanges, "del")
    diff.additions += changeRuns(rightRanges, "ins")
  }

  /** Pairs an unmatched stretch in order; whatever is left is removed before added at each spot. */
  const align = (lefts: number[], rights: number[]) => {
    let next = 0
    let unpaired: number[] = []
    for (const i of lefts) {
      const k = rights.findIndex((j, at) => at >= next && similarity(a[i]!, b[j]!) >= PAIR_SIMILARITY)
      if (k < 0) {
        unpaired.push(i)
        continue
      }
      unpaired.forEach(removed)
      unpaired = []
      rights.slice(next, k).forEach(added)
      changed(i, rights[k]!)
      next = k + 1
    }
    unpaired.forEach(removed)
    rights.slice(next).forEach(added)
  }

  let i = 0
  let j = 0
  let lefts: number[] = []
  let rights: number[] = []
  for (const part of diffArrays(
    a.map((block) => block.key),
    b.map((block) => block.key)
  )) {
    if (part.removed) {
      for (let n = 0; n < part.count; n++) lefts.push(i++)
    } else if (part.added) {
      for (let n = 0; n < part.count; n++) rights.push(j++)
    } else {
      align(lefts, rights)
      lefts = []
      rights = []
      for (let n = 0; n < part.count; n++) diff.rows.push({ kind: "same", left: i++, right: j++ })
    }
  }
  align(lefts, rights)
  return diff
}
