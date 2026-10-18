import type { JSONContent } from "@tiptap/core"
import { diffArrays, diffWordsWithSpace } from "diff"
import type { ScriptElementType } from "./script"

export type DiffOp = "same" | "del" | "ins"

/** A piece of one text node, with that node's own marks. A line break is a segment of its own, `"\n"`. */
export type DiffSegment = { text: string; marks?: JSONContent["marks"]; op: DiffOp }

/**
 * Where a paragraph sits in a list: its list's kind and nesting `depth` (0 at the top level). A list
 * item's first paragraph carries its marker; the item's later paragraphs are `continued`, drawn without one.
 */
export type DiffList = { kind: "bullet" | "ordered"; depth: number; continued?: true }

/**
 * A paragraph or Scene Break of one side, cut into segments (a Scene Break has none). A block quote's
 * paragraphs are blocks of their own, marked `quoted`, and so are a Script's lines, with their `element`,
 * and a list's paragraphs, with their `list`.
 */
export type DiffBlock = {
  type: "paragraph" | "sceneBreak"
  segments: DiffSegment[]
  quoted?: boolean
  align?: "center" | "right"
  element?: ScriptElementType
  list?: DiffList
}

/** A part of a paragraph's structure that counts as a change: its quote, alignment, list, Script, or element. */
export type StructureChange = "quote" | "align" | "list" | "script" | "element"

/**
 * One aligned row: a block index on each side it has a block on. A changed row also has `merged`, both
 * sides' segments interleaved in reading order (the right side's for unchanged text), for one inline column,
 * and `structure`, what of the two sides' structure differs, when any does.
 */
export type DiffRow =
  | { kind: "same"; left: number; right: number }
  | { kind: "changed"; left: number; right: number; merged: DiffSegment[]; structure?: StructureChange[] }
  | { kind: "removed"; left: number; right?: never }
  | { kind: "added"; right: number; left?: never }

export type DocumentDiff = {
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
type Look = Pick<DiffBlock, "quoted" | "align" | "element" | "list">
type Block = Pick<DiffBlock, "type"> & Look & { runs: Run[]; text: string }
type Range = { length: number; op: DiffOp }

/** `depth` is the depth a list met here would have. */
function blocksOf(doc: JSONContent, depth = 0): Block[] {
  return (doc.content ?? []).flatMap((node): Block[] => {
    if (node.type === "sceneBreak") return [{ type: "sceneBreak", runs: [], text: "" }]
    if (node.type === "blockquote") return blocksOf(node, depth).map((block) => ({ ...block, quoted: true }))
    if (node.type === "script") return blocksOf(node)
    if (node.type === "bulletList" || node.type === "orderedList") {
      const kind = node.type === "bulletList" ? "bullet" : "ordered"
      return (node.content ?? []).flatMap((item) =>
        blocksOf(item, depth + 1).map((block, n) => {
          // A nested list's paragraphs already have their own.
          if (block.list || block.type !== "paragraph") return block
          const list: DiffList = { kind, depth, ...(n > 0 && { continued: true }) }
          return { ...block, list }
        })
      )
    }
    const runs = (node.content ?? []).flatMap((n): Run[] => {
      if (n.type === "hardBreak") return [{ text: "\n", marks: n.marks }]
      return n.type === "text" && n.text ? [{ text: n.text, marks: n.marks }] : []
    })
    const text = runs.map((r) => r.text).join("")
    const align = node.attrs?.textAlign
    return [
      {
        type: "paragraph",
        runs,
        text,
        ...((align === "center" || align === "right") && { align }),
        ...(node.type === "scriptElement" && { element: node.attrs?.element ?? "action" }),
      },
    ]
  })
}

/**
 * Text plus structure, so a paragraph that changes structure no longer anchors as unchanged. A plain
 * paragraph's key is its bare text.
 */
function structureKey(block: Block): string {
  if (block.type === "sceneBreak") return SCENE_BREAK_KEY
  const { quoted, align, list, element } = block
  if (!quoted && !align && !list && !element) return block.text
  const listed = list ? `${list.kind}${list.depth}${list.continued ? "+" : ""}` : ""
  return `\u0000${quoted ? "q" : ""}\u0000${align ?? ""}\u0000${listed}\u0000${element ?? ""}\u0000${block.text}`
}

/** What of `a`'s and `b`'s structure differs. A block is in a Script when it has an `element`. */
export function structureChanges(a: Look, b: Look): StructureChange[] {
  const changes: StructureChange[] = []
  if (!a.quoted !== !b.quoted) changes.push("quote")
  if (a.align !== b.align) changes.push("align")
  if (a.list?.kind !== b.list?.kind || a.list?.depth !== b.list?.depth || a.list?.continued !== b.list?.continued) {
    changes.push("list")
  }
  if (!a.element !== !b.element) changes.push("script")
  if ((a.element ?? "action") !== (b.element ?? "action")) changes.push("element")
  return changes
}

/**
 * Whether `block` has `change`'s part of its structure rather than its plain state: unquoted, left-aligned,
 * not a list item, prose outside a Script, or Action inside one.
 */
export function nonPlain(block: Look, change: StructureChange): boolean {
  switch (change) {
    case "quote":
      return !!block.quoted
    case "align":
      return !!block.align
    case "list":
      return !!block.list
    case "script":
      return !!block.element
    case "element":
      return (block.element ?? "action") !== "action"
  }
}

function look(block: Block): Look {
  return {
    ...(block.quoted && { quoted: true }),
    ...(block.align && { align: block.align }),
    ...(block.element && { element: block.element }),
    ...(block.list && { list: block.list }),
  }
}

function similarity(a: Block, b: Block): number {
  if (a.type !== "paragraph" || b.type !== "paragraph") return 0
  const longer = Math.max(a.text.length, b.text.length)
  if (!longer) return 0
  let shared = 0
  for (const part of diffWordsWithSpace(a.text, b.text)) if (!part.added && !part.removed) shared += part.value.length
  return shared / longer
}

/**
 * Cuts `runs` at the range boundaries, so every segment keeps the marks of the node it came from. One
 * list of segments per range.
 */
function segment(runs: Run[], ranges: Range[]): DiffSegment[][] {
  const out: DiffSegment[][] = []
  let r = 0
  let used = 0
  for (const range of ranges) {
    const pieces: DiffSegment[] = []
    out.push(pieces)
    let left = range.length
    while (left > 0 && r < runs.length) {
      const run = runs[r]!
      const take = Math.min(left, run.text.length - used)
      pieces.push({ text: run.text.slice(used, used + take), marks: run.marks, op: range.op })
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
  return { type: block.type, segments: block.runs.map((run) => ({ ...run, op })), ...look(block) }
}

function changeRuns(ranges: Range[], op: DiffOp): number {
  return ranges.filter((range, i) => range.op === op && ranges[i - 1]?.op !== op).length
}

/**
 * What changed from `left` to `right`, two Chapters' or two Entries' ProseMirror JSON. Blocks are aligned
 * first (equal text and structure anchor, then leftover paragraphs pair by word similarity), then
 * words are diffed inside each pair. Only text and structure (quote, alignment, list, Script and element)
 * count: a changed row's changed structure is one addition if it isn't plain on the right (see `nonPlain`)
 * and one removal if it isn't plain on the left, so quoting is an addition, un-quoting a removal, and
 * bullet → numbered both. Renumbering, formatting, `author` and `note` changes are not differences. Each
 * side's blocks and segments keep that side's own look and marks.
 */
export function diffDocuments(left: JSONContent, right: JSONContent): DocumentDiff {
  const a = blocksOf(left)
  const b = blocksOf(right)
  const diff: DocumentDiff = {
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
    const parts = diffWordsWithSpace(a[i]!.text, b[j]!.text)
    const leftRanges: Range[] = []
    const rightRanges: Range[] = []
    for (const part of parts) {
      const length = part.value.length
      if (!part.added) leftRanges.push({ length, op: part.removed ? "del" : "same" })
      if (!part.removed) rightRanges.push({ length, op: part.added ? "ins" : "same" })
    }
    const lefts = segment(a[i]!.runs, leftRanges)
    const rights = segment(b[j]!.runs, rightRanges)
    const merged: DiffSegment[] = []
    let l = 0
    let r = 0
    for (const part of parts) {
      if (part.removed) {
        merged.push(...lefts[l++]!)
        continue
      }
      if (!part.added) l++
      merged.push(...rights[r++]!)
    }
    const structure = structureChanges(a[i]!, b[j]!)
    diff.rows.push({ kind: "changed", left: i, right: j, merged, ...(structure.length > 0 && { structure }) })
    diff.left[i] = { type: "paragraph", segments: lefts.flat(), ...look(a[i]!) }
    diff.right[j] = { type: "paragraph", segments: rights.flat(), ...look(b[j]!) }
    diff.removals += changeRuns(leftRanges, "del") + (structure.some((c) => nonPlain(a[i]!, c)) ? 1 : 0)
    diff.additions += changeRuns(rightRanges, "ins") + (structure.some((c) => nonPlain(b[j]!, c)) ? 1 : 0)
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
    a.map(structureKey),
    b.map(structureKey)
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

/**
 * Each block's number in its ordered list, counted down one side the way the editor draws it, or undefined
 * for anything without a number. Numbers aren't diffed, so each side counts its own.
 */
export function listNumbers(blocks: DiffBlock[]): (number | undefined)[] {
  const counts: number[] = []
  return blocks.map(({ list }) => {
    if (!list) {
      counts.length = 0
      return undefined
    }
    counts.length = list.depth + 1
    if (list.continued) return undefined
    if (list.kind === "bullet") {
      counts[list.depth] = 0
      return undefined
    }
    counts[list.depth] = (counts[list.depth] ?? 0) + 1
    return counts[list.depth]
  })
}

/** A run of unchanged rows, `from` up to but not including `to`, folded away. */
export type Fold = { kind: "fold"; from: number; to: number }
export type FoldItem = { kind: "row"; row: number } | Fold

/**
 * `rows` with only the changes showing: every changed row, `context` unchanged rows on each side of one,
 * and each other run of unchanged rows as a single Fold.
 */
export function foldRows(rows: DiffRow[], context = 1): FoldItem[] {
  const shown = rows.map(() => false)
  rows.forEach((row, r) => {
    if (row.kind === "same") return
    for (let n = Math.max(0, r - context); n <= Math.min(rows.length - 1, r + context); n++) shown[n] = true
  })
  const items: FoldItem[] = []
  shown.forEach((show, r) => {
    const last = items.at(-1)
    if (show) items.push({ kind: "row", row: r })
    else if (last?.kind === "fold") last.to = r + 1
    else items.push({ kind: "fold", from: r, to: r + 1 })
  })
  return items
}
