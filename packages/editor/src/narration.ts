import type { Node as PMNode } from "@tiptap/pm/model"
import { type EntryMention, type EntryMentionTarget, entryNamed, findEntryMentions } from "./entry-mentions"

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
  /** Who says it, if not the narrator. A cue carries the speaker of the Dialogue it introduces. */
  speaker?: NarrationSpeaker
}

/** A Character Entry, or a Script cue that names no Entry: its text upper-cased with spacing collapsed. */
export type NarrationSpeaker = { entryId: string } | { cue: string }

/** A string that identifies a speaker, for maps and saved settings. */
export function speakerKey(s: NarrationSpeaker): string {
  return "entryId" in s ? `entry:${s.entryId}` : `cue:${s.cue}`
}

const SENTENCE_PAUSE_MS = 0
const PARAGRAPH_PAUSE_MS = 250
const HEADING_PAUSE_MS = 500
const CUE_PAUSE_MS = 300
const SCENE_BREAK_PAUSE_MS = 1500
const INTRO_PAUSE_MS = 900

/** Words that end in a full stop without ending the sentence. */
const ABBREVIATION = /(?:^|[\s“"‘'(])(?:Mr|Mrs|Ms|Mx|Dr|St|Sr|Jr|Prof|Mt|Capt|Col|Gen|Lt|Sgt|Rev|vs|etc|e\.g|i\.e)\.\s*$/i

/**
 * A Chapter's units in reading order. With `characters`, each unit a Character speaks names them: Script Dialogue
 * by its cue, and the quoted words of prose dialogue as `attributeQuotes` works them out, cut from the rest of their
 * sentence.
 */
export function narrationUnits(doc: PMNode, characters: readonly EntryMentionTarget[] = []): NarrationUnit[] {
  const units: NarrationUnit[] = []
  const turns = new Turns()
  doc.forEach((node, _, block) => {
    if (node.type.name === "sceneBreak") {
      turns.reset()
      units.push({ block, from: 0, to: 0, speak: "", pauseAfterMs: SCENE_BREAK_PAUSE_MS, kind: "pause" })
      return
    }
    if (node.type.name === "script") turns.reset()
    let base = 0
    let cue: NarrationSpeaker | undefined
    const visit = (textblock: PMNode) => {
      const text = textblock.textContent
      const element = textblock.type.name === "scriptElement" ? (textblock.attrs.element as string) : null
      if (element === "character") cue = cueSpeaker(text, characters)
      else if (element && element !== "dialogue" && element !== "parenthetical") cue = undefined
      const quotes = !element && characters.length ? attributeQuotes(text, characters, turns) : []
      units.push(...textblockUnits(element, text, block, base, cue, quotes))
      base += text.length
    }
    if (node.isTextblock) visit(node)
    else node.descendants((child) => (child.isTextblock ? (visit(child), false) : true))
  })
  return units
}

function textblockUnits(
  element: string | null,
  text: string,
  block: number,
  base: number,
  cue: NarrationSpeaker | undefined,
  quotes: readonly SpokenQuote[]
): NarrationUnit[] {
  if (element === "transition") return []
  if (element === "sceneHeading" || element === "character") {
    const [from, to] = trimmed(text, 0, text.length)
    if (from === to) return []
    const line = text.slice(from, to)
    return [
      element === "sceneHeading"
        ? { block, from: base + from, to: base + to, speak: expandSceneHeading(line), pauseAfterMs: HEADING_PAUSE_MS, kind: "heading" }
        : { block, from: base + from, to: base + to, speak: cueName(line), pauseAfterMs: CUE_PAUSE_MS, kind: "cue", ...(cue && { speaker: cue }) },
    ]
  }
  const speaker = element === "dialogue" ? cue : undefined
  const units: NarrationUnit[] = []
  for (const [from, to] of sentences(text)) {
    const cuts = [from, ...quotes.flatMap((q) => [q.from, q.to]).filter((edge) => edge > from && edge < to), to]
    for (let i = 1; i < cuts.length; i++) {
      const [a, b] = trimmed(text, cuts[i - 1]!, cuts[i]!)
      if (a === b) continue
      const said = quotes.find((q) => a >= q.from && b <= q.to)?.speaker ?? speaker
      units.push({
        block,
        from: base + a,
        to: base + b,
        speak: text.slice(a, b).replace(/\s+/g, " "),
        pauseAfterMs: SENTENCE_PAUSE_MS,
        kind: "sentence",
        ...(said && { speaker: said }),
      })
    }
  }
  if (units.length) units.at(-1)!.pauseAfterMs = PARAGRAPH_PAUSE_MS
  return units
}

function cueSpeaker(line: string, characters: readonly EntryMentionTarget[]): NarrationSpeaker | undefined {
  const name = cueName(line.trim()).trim()
  if (!name) return undefined
  const entry = entryNamed(name, characters)
  return entry ? { entryId: entry.id } : { cue: name.replace(/\s+/g, " ").toUpperCase() }
}

/** A quotation in a paragraph, from its opening mark to just past its closing one. */
export type QuoteSpan = { from: number; to: number; unclosed: boolean }
type SpokenQuote = QuoteSpan & { speaker: NarrationSpeaker }

/**
 * The double-quoted spans in `text`, straight or curly. A quote that never closes runs to the end and is `unclosed`,
 * as when a speech carries on into the next paragraph.
 */
export function quoteSpans(text: string): QuoteSpan[] {
  const spans: QuoteSpan[] = []
  let open = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (open < 0 && (c === "“" || c === '"')) open = i
    else if (open >= 0 && (c === "”" || c === '"')) {
      spans.push({ from: open, to: i + 1, unclosed: false })
      open = -1
    }
  }
  if (open >= 0) spans.push({ from: open, to: text.length, unclosed: true })
  return spans
}

const SPEECH_VERBS = (
  "said says asked asks replied replies answered answers shouted shouts yelled yells called calls cried cries " +
  "whispered whispers muttered mutters murmured murmurs told tells added adds snapped snaps sighed sighs began " +
  "begins continued continues agreed agrees demanded demands insisted insists admitted admits laughed laughs " +
  "growled growls hissed hisses breathed breathes screamed screams exclaimed exclaims protested protests " +
  "offered offers warned warns explained explains repeated repeats interrupted interrupts mumbled mumbles " +
  "grumbled grumbles stammered stammers sobbed sobs pleaded pleads promised promises suggested suggests"
).replace(/ /g, "|")
const VERB_AFTER = new RegExp(`^[^\\S\\n]+(?:${SPEECH_VERBS})(?![\\p{L}\\p{M}\\p{N}_])`, "iu")
const VERB_BEFORE = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${SPEECH_VERBS})[^\\S\\n]+$`, "iu")

/** Who's speaking as one paragraph follows another: the turn-taking state of `attributeQuotes`. */
class Turns {
  prev?: string
  last?: string
  named = new Set<string>()
  /** Who was speaking when the last quote paragraph's quote was left open: null for the narrator. */
  open?: string | null

  identify(id: string) {
    if (id === this.last) return
    this.prev = this.last
    this.last = id
  }

  take(): string | undefined {
    if (this.open !== undefined) return this.open ?? undefined
    if (!this.prev || !this.last) return undefined
    ;[this.prev, this.last] = [this.last, this.prev]
    return this.last
  }

  reset() {
    this.prev = this.last = this.open = undefined
    this.named.clear()
  }
}

/**
 * The quotes in one prose paragraph that a Character speaks, as far as can be told. A speech tag in the quote's
 * sentence ("Mara said") decides it; otherwise a paragraph naming exactly one Character outside its quotes is
 * theirs; otherwise the speaker alternates between the last two identified, unless the last quote paragraph's quote
 * was left open (the same speaker carries on) or a third Character has been named since the run began (no guess).
 * Names inside quotes never count.
 */
function attributeQuotes(text: string, characters: readonly EntryMentionTarget[], turns: Turns): SpokenQuote[] {
  const quotes = quoteSpans(text)
  const names = findEntryMentions(text, characters).filter((m) => !quotes.some((q) => m.from < q.to && m.to > q.from))
  for (const m of names) turns.named.add(m.entryId)

  let ids: (string | undefined)[] = []
  if (quotes.length) {
    const ranges = sentences(text)
    const tags = quotes.map((q, i) => speechTag(text, q, quotes[i - 1], quotes[i + 1], ranges, names))
    if (tags.some(Boolean)) {
      for (const tag of tags) if (tag) turns.identify(tag)
      ids = tags.map((tag, i) => tag ?? tags.slice(0, i).findLast(Boolean) ?? tags.find(Boolean))
    } else {
      const beat = new Set(names.map((m) => m.entryId))
      const id = beat.size === 1 ? [...beat][0]! : turns.take()
      if (beat.size === 1) turns.identify(id!)
      ids = quotes.map(() => id)
    }
    turns.open = quotes.at(-1)!.unclosed ? (ids.at(-1) ?? null) : undefined
  }
  if (turns.named.size >= 3) {
    turns.prev = turns.last = undefined
    turns.named.clear()
  }
  return quotes.flatMap((q, i) => {
    const entryId = ids[i]
    return entryId ? [{ ...q, speaker: { entryId } }] : []
  })
}

/**
 * The Character a quote's speech tag names: a name next to a speech verb ("Mara said", "said Mara") between the
 * quote and the edge of its sentence or the next quote. A quote ending in `?`, `!`, `…` or a dash ends its sentence
 * without ending the line, so its tag can be the next sentence ("“Ready?” Mara asked.").
 */
function speechTag(
  text: string,
  quote: QuoteSpan,
  before: QuoteSpan | undefined,
  after: QuoteSpan | undefined,
  ranges: readonly [number, number][],
  names: readonly EntryMention[]
): string | undefined {
  const at = (i: number) => ranges.findIndex(([from, to]) => i >= from && i < to)
  const end = at(quote.to - 1)
  const runsOn = end >= 0 && ranges[end]![1] === quote.to && /[?!…—–-]\W*$/u.test(text.slice(quote.from, quote.to))
  const tail = ranges[runsOn ? end + 1 : end]?.[1] ?? quote.to
  const head = ranges[at(quote.from)]?.[0] ?? quote.from
  const regions: [number, number][] = [
    [quote.to, Math.min(tail, after?.from ?? text.length)],
    [Math.max(head, before?.to ?? 0), quote.from],
  ]
  for (const [from, to] of regions) {
    for (const m of names) {
      if (m.from < from || m.to > to) continue
      if (VERB_AFTER.test(text.slice(m.to, to)) || VERB_BEFORE.test(text.slice(from, m.from))) return m.entryId
    }
  }
  return undefined
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
export function cueName(text: string): string {
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

/**
 * The index of the first unit that starts at or after a point (one that's only partly after it is passed over), or
 * -1. What follows a unit once its end is found again in a document others may have edited since.
 */
export function unitAfter(units: readonly NarrationUnit[], block: number, offset: number): number {
  return units.findIndex((u) => u.block > block || (u.block === block && u.from >= offset && u.to > offset))
}

/**
 * The document position of `offset` characters into top-level block `block`'s text, as `narrationUnits` counts
 * them. At the seam between two text blocks of a quote or Script, `bias` 1 picks the start of the later one and -1
 * the end of the earlier.
 */
export function narrationPos(doc: PMNode, block: number, offset: number, bias: 1 | -1 = 1): number {
  if (block >= doc.childCount) return doc.content.size
  let start = 0
  for (let i = 0; i < block; i++) start += doc.child(i).nodeSize
  const top = doc.child(block)
  if (top.isTextblock) return start + 1 + textblockPos(top, offset)
  if (top.isLeaf) return start

  let rest = offset
  let found: number | null = null
  let lastEnd = start + 1
  top.descendants((child, pos) => {
    if (found !== null) return false
    if (!child.isTextblock) return true
    const length = child.textContent.length
    const at = start + 1 + pos + 1
    if (rest < length || (rest === length && bias < 0)) found = at + textblockPos(child, rest)
    else rest -= length
    lastEnd = at + child.content.size
    return false
  })
  return found ?? lastEnd
}

function textblockPos(node: PMNode, offset: number): number {
  let pos = 0
  let chars = 0
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    const length = child.isText ? child.text!.length : (child.type.spec.leafText?.(child).length ?? 0)
    if (offset <= chars + length) return pos + (child.isText || offset === chars ? offset - chars : child.nodeSize)
    chars += length
    pos += child.nodeSize
  }
  return pos
}

/** Where document position `pos` is in Narration's coordinates: the inverse of `narrationPos`. */
export function narrationPoint(doc: PMNode, pos: number): { block: number; offset: number } {
  const $pos = doc.resolve(pos)
  const block = $pos.index(0)
  if ($pos.depth === 0) return { block, offset: 0 }
  return { block, offset: doc.textBetween($pos.before(1), pos).length }
}
