import type { ContentJSON } from "./credits"

/** What the matcher needs of an Entry. */
export type MentionTarget = { id: string; name: string; aliases: readonly string[]; linkMentions: boolean }

/**
 * A Mention in one block of text, as UTF-16 offsets (the same units as ProseMirror positions). `linked` is
 * false for an Entry that doesn't link its Mentions; those still matter for spellcheck.
 */
export type Mention = { entryId: string; from: number; to: number; linked: boolean }

const WORD = "[\\p{L}\\p{M}\\p{N}_]"

/**
 * Every Mention of `entries` in `text`: names and Aliases as whole words or phrases, ignoring case,
 * including before a possessive 's. Where matches overlap, the longest wins ("Gull Point Light" over
 * "Gull Point"). Sorted by position.
 */
export function findMentions(text: string, entries: readonly MentionTarget[]): Mention[] {
  const candidates: Mention[] = []
  for (const { pattern, entryId, linked } of termPatterns(entries)) {
    for (const match of text.matchAll(pattern)) {
      candidates.push({ entryId, from: match.index, to: match.index + match[0].length, linked })
    }
  }
  candidates.sort((a, b) => b.to - b.from - (a.to - a.from) || a.from - b.from)

  const chosen: Mention[] = []
  for (const c of candidates) {
    if (chosen.every((m) => c.to <= m.from || c.from >= m.to)) chosen.push(c)
  }
  return chosen.sort((a, b) => a.from - b.from)
}

const patterns = new WeakMap<readonly MentionTarget[], { pattern: RegExp; entryId: string; linked: boolean }[]>()

function termPatterns(entries: readonly MentionTarget[]) {
  let list = patterns.get(entries)
  if (list) return list
  list = []
  for (const entry of entries) {
    for (const term of [entry.name, ...entry.aliases]) {
      const words = term.trim().split(/\s+/u).filter(Boolean)
      if (!words.length) continue
      // A trailing apostrophe isn't a word character, so "Wren's" already ends "Wren" on a boundary.
      const body = words.map(escape).join("\\s+")
      list.push({ pattern: new RegExp(`(?<!${WORD})${body}(?!${WORD})`, "giu"), entryId: entry.id, linked: entry.linkMentions })
    }
  }
  patterns.set(entries, list)
  return list
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")
}

/** The text of each paragraph (or other text block) in a document, which Mentions never cross. */
export function blockTexts(node: ContentJSON, into: string[] = []): string[] {
  const children = node.content ?? []
  if (children.some((c) => c.type === "text")) {
    into.push(children.map((c) => c.text ?? "").join(""))
  } else {
    for (const child of children) blockTexts(child, into)
  }
  return into
}

/** How many times each Entry that links its Mentions is mentioned in a document. */
export function countMentions(doc: ContentJSON, entries: readonly MentionTarget[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const text of blockTexts(doc)) {
    for (const { entryId, linked } of findMentions(text, entries)) {
      if (linked) counts.set(entryId, (counts.get(entryId) ?? 0) + 1)
    }
  }
  return counts
}
