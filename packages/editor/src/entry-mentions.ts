import type { ContentJSON } from "./credits"

/** What the matcher needs of an Entry. */
export type EntryMentionTarget = { id: string; name: string; aliases: readonly string[]; linkEntryMentions: boolean }

/**
 * An Entry Mention in one block of text, as UTF-16 offsets (the same units as ProseMirror positions). `linked` is
 * false for an Entry that doesn't link its Entry Mentions; those still matter for spellcheck.
 */
export type EntryMention = { entryId: string; from: number; to: number; linked: boolean }

const WORD = "[\\p{L}\\p{M}\\p{N}_]"

/**
 * Every Entry Mention of `entries` in `text`: names and Aliases as whole words or phrases on one line, ignoring
 * case, including before a possessive 's. Where matches overlap, the longest wins ("Gull Point Light" over
 * "Gull Point"). Sorted by position.
 */
export function findEntryMentions(text: string, entries: readonly EntryMentionTarget[]): EntryMention[] {
  const candidates: EntryMention[] = []
  for (const { pattern, entryId, linked } of termPatterns(entries)) {
    for (const match of text.matchAll(pattern)) {
      candidates.push({ entryId, from: match.index, to: match.index + match[0].length, linked })
    }
  }
  candidates.sort((a, b) => b.to - b.from - (a.to - a.from) || a.from - b.from)

  const chosen: EntryMention[] = []
  for (const c of candidates) {
    if (chosen.every((m) => c.to <= m.from || c.from >= m.to)) chosen.push(c)
  }
  return chosen.sort((a, b) => a.from - b.from)
}

const patterns = new WeakMap<readonly EntryMentionTarget[], { pattern: RegExp; entryId: string; linked: boolean }[]>()

function termPatterns(entries: readonly EntryMentionTarget[]) {
  let list = patterns.get(entries)
  if (list) return list
  list = []
  for (const entry of entries) {
    for (const term of [entry.name, ...entry.aliases]) {
      const words = term.trim().split(/\s+/u).filter(Boolean)
      if (!words.length) continue
      // A trailing apostrophe isn't a word character, so "Wren's" already ends "Wren" on a boundary.
      const body = words.map(escape).join("[^\\S\\n]+")
      list.push({ pattern: new RegExp(`(?<!${WORD})${body}(?!${WORD})`, "giu"), entryId: entry.id, linked: entry.linkEntryMentions })
    }
  }
  patterns.set(entries, list)
  return list
}

const WORD_CHAR = new RegExp(`^${WORD}$`, "u")
const EDGES = /^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu

/**
 * The Entry name a selection of `text` (one block) stands for: snapped outward to whole words, trimmed of
 * edge punctuation and a possessive 's, with whitespace collapsed. Null if no letter is left, it crosses a line
 * break, or it runs past `max` characters.
 */
export function entryNameAt(text: string, from: number, to: number, max: number): string | null {
  const word = (i: number) => WORD_CHAR.test(text[i] ?? "")
  while (from > 0 && word(from - 1) && word(from)) from--
  while (to < text.length && word(to - 1) && word(to)) to++
  const name = text
    .slice(from, to)
    .replace(EDGES, "")
    .replace(/['’]s$/iu, "")
    .replace(EDGES, "")
  if (name.includes("\n")) return null
  const spaced = name.replace(/\s+/gu, " ")
  return /\p{L}/u.test(spaced) && spaced.length <= max ? spaced : null
}

/** The Entry whose name or an Alias is `name`, ignoring case and spacing. */
export function entryNamed<T extends EntryMentionTarget>(name: string, entries: readonly T[]): T | undefined {
  const key = nameKey(name)
  return entries.find((e) => [e.name, ...e.aliases].some((term) => nameKey(term) === key))
}

function nameKey(name: string): string {
  return name.trim().replace(/\s+/gu, " ").toLowerCase()
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * The text of each paragraph (or other text block) in a document, which Entry Mentions never cross. A line break
 * reads as `\n`, as in the editor's `textContent`.
 */
export function blockTexts(node: ContentJSON, into: string[] = []): string[] {
  const children = node.content ?? []
  if (children.some((c) => c.type === "text" || c.type === "hardBreak")) {
    into.push(children.map((c) => (c.type === "hardBreak" ? "\n" : (c.text ?? ""))).join(""))
  } else {
    for (const child of children) blockTexts(child, into)
  }
  return into
}

/** How many times each Entry that links its Entry Mentions is mentioned in a document. */
export function countEntryMentions(doc: ContentJSON, entries: readonly EntryMentionTarget[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const text of blockTexts(doc)) {
    for (const { entryId, linked } of findEntryMentions(text, entries)) {
      if (linked) counts.set(entryId, (counts.get(entryId) ?? 0) + 1)
    }
  }
  return counts
}
