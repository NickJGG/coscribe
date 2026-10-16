import type { Node as PMNode } from "@tiptap/pm/model"

/**
 * One step of Narration: what to say, and the part of a top-level block to highlight while saying it. `from` and
 * `to` are offsets into the block's `textContent` (a block quote's paragraphs or a Script's lines run together, and
 * a line break is one character). `speak` can differ from the highlighted text: an expanded `INT.`, a Character
 * cue without its extension, or nothing at all for a Scene Break's pause.
 */
export type NarrationUnit = {
  /** The top-level block, or -1 for the Chapter's intro and "The End.", which belong to no block. */
  block: number
  from: number
  to: number
  speak: string
  pauseAfterMs: number
  kind: "sentence" | "heading" | "cue" | "pause" | "intro" | "end"
}

const SENTENCE_PAUSE_MS = 0
const PARAGRAPH_PAUSE_MS = 250
const HEADING_PAUSE_MS = 500
const CUE_PAUSE_MS = 300
const SCENE_BREAK_PAUSE_MS = 1500
const INTRO_PAUSE_MS = 900

/** Words that end in a full stop without ending the sentence. */
const ABBREVIATION = /(?:^|[\s“"‘'(])(?:Mr|Mrs|Ms|Mx|Dr|St|Sr|Jr|Prof|Mt|Capt|Col|Gen|Lt|Sgt|Rev|vs|etc|e\.g|i\.e)\.\s*$/i

export function narrationUnits(doc: PMNode): NarrationUnit[] {
  const units: NarrationUnit[] = []
  doc.forEach((node, _, block) => {
    if (node.type.name === "sceneBreak") {
      units.push({ block, from: 0, to: 0, speak: "", pauseAfterMs: SCENE_BREAK_PAUSE_MS, kind: "pause" })
      return
    }
    let base = 0
    const visit = (textblock: PMNode) => {
      const text = textblock.textContent
      units.push(...textblockUnits(textblock, text, block, base))
      base += text.length
    }
    if (node.isTextblock) visit(node)
    else node.descendants((child) => (child.isTextblock ? (visit(child), false) : true))
  })
  return units
}

function textblockUnits(node: PMNode, text: string, block: number, base: number): NarrationUnit[] {
  const element = node.type.name === "scriptElement" ? (node.attrs.element as string) : null
  if (element === "transition") return []
  if (element === "sceneHeading" || element === "character") {
    const [from, to] = trimmed(text, 0, text.length)
    if (from === to) return []
    const line = text.slice(from, to)
    return [
      element === "sceneHeading"
        ? { block, from: base + from, to: base + to, speak: expandSceneHeading(line), pauseAfterMs: HEADING_PAUSE_MS, kind: "heading" }
        : { block, from: base + from, to: base + to, speak: cueName(line), pauseAfterMs: CUE_PAUSE_MS, kind: "cue" },
    ]
  }
  const units = sentences(text).map(([from, to]): NarrationUnit => ({
    block,
    from: base + from,
    to: base + to,
    speak: text.slice(from, to).replace(/\s+/g, " "),
    pauseAfterMs: SENTENCE_PAUSE_MS,
    kind: "sentence",
  }))
  if (units.length) units.at(-1)!.pauseAfterMs = PARAGRAPH_PAUSE_MS
  return units
}

/** `text`'s sentences as trimmed `[from, to)` ranges, keeping dialogue tags and abbreviations with their sentence. */
export function sentences(text: string): [number, number][] {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" })
  // A line break would end a sentence; read it as a space instead, keeping the offsets.
  const flat = text.replace(/\n/g, " ")
  const ranges: [number, number][] = []
  for (const { segment, index } of segmenter.segment(flat)) {
    const [from, to] = trimmed(flat, index, index + segment.length)
    if (from === to) continue
    const last = ranges.at(-1)
    if (last && (ABBREVIATION.test(flat.slice(last[0], last[1])) || /^[“"‘'(]*\p{Ll}/u.test(flat.slice(from, to)))) {
      last[1] = to
    } else {
      ranges.push([from, to])
    }
  }
  return ranges
}

function trimmed(text: string, from: number, to: number): [number, number] {
  while (from < to && /\s/.test(text[from]!)) from++
  while (to > from && /\s/.test(text[to - 1]!)) to--
  return [from, to]
}

/** A Scene Heading as it's read: `INT.` and `EXT.` spelled out. */
export function expandSceneHeading(text: string): string {
  return text
    .replace(/^\s*(?:INT\.?\s*\/\s*EXT\.?|I\/E\.?)(?=\s|$)/i, "Interior/Exterior")
    .replace(/^\s*(?:EXT\.?\s*\/\s*INT\.?)(?=\s|$)/i, "Exterior/Interior")
    .replace(/^\s*INT\.(?=\s|$)/i, "Interior")
    .replace(/^\s*EXT\.(?=\s|$)/i, "Exterior")
}

/** A Character cue as it's read: the name, without an extension like `(V.O.)` or `(CONT'D)`. */
function cueName(text: string): string {
  return text.replace(/\s*\([^)]*\)\s*$/, "") || text
}

/** "Chapter n. Title." and a pause, read before a Chapter's text. */
export function chapterIntro(n: number, title: string): NarrationUnit {
  const name = title.trim()
  const speak = name ? `Chapter ${n}. ${name}${/[.!?…]$/.test(name) ? "" : "."}` : `Chapter ${n}.`
  return { block: -1, from: 0, to: 0, speak, pauseAfterMs: INTRO_PAUSE_MS, kind: "intro" }
}

/** Read after a Story's last Chapter. */
export const THE_END: NarrationUnit = { block: -1, from: 0, to: 0, speak: "The End.", pauseAfterMs: 0, kind: "end" }

/**
 * The index of the unit at a point (the one it's inside, or else the first after it), or -1 if none is. With an
 * offset of 0, the first unit at or after `block`.
 */
export function unitAt(units: readonly NarrationUnit[], block: number, offset = 0): number {
  return units.findIndex((u) => u.block > block || (u.block === block && (u.to > offset || u.from >= offset)))
}

/** The top-level blocks Narration reads text from, in order: what "paragraph x of y" counts. */
export function narratedBlocks(units: readonly NarrationUnit[]): number[] {
  const blocks: number[] = []
  for (const u of units) if (u.block >= 0 && u.kind !== "pause" && blocks.at(-1) !== u.block) blocks.push(u.block)
  return blocks
}
