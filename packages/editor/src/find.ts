/** Story search: case-, accent-, quote- and smart-punctuation-insensitive substring matching within one block of text. */

/** Shorter queries match too much to be useful. */
export const MIN_QUERY = 2

/** A match as UTF-16 offsets into the original text (the same units as ProseMirror positions). */
export type FindMatch = { from: number; to: number }

/** Text folded for matching, with each folded unit's source range in the original. */
export type FoldedText = { folded: string; starts: number[]; ends: number[] }

const FOLDS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "′": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "‟": '"',
  "″": '"',
  "…": "...",
  "—": "--",
}

function foldChar(ch: string): string {
  return (FOLDS[ch] ?? ch).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/** Folds one code point at a time, so every folded unit maps back to the original text. */
export function foldText(text: string): FoldedText {
  let folded = ""
  const starts: number[] = []
  const ends: number[] = []
  let i = 0
  for (const ch of text) {
    const f = foldChar(ch)
    const end = i + ch.length
    if (f) {
      for (let k = 0; k < f.length; k++) {
        starts.push(i)
        ends.push(end)
      }
      folded += f
    } else if (ends.length) {
      // A lone combining mark belongs to the letter before it.
      ends[ends.length - 1] = end
    }
    i = end
  }
  return { folded, starts, ends }
}

/** Folds a query the way `foldText` folds the text it's matched against, without surrounding spaces. */
export function foldQuery(query: string): string {
  return foldText(query.trim()).folded
}

/** Non-overlapping matches of a query from `foldQuery`, in order. */
export function findFolded(text: FoldedText, query: string): FindMatch[] {
  const matches: FindMatch[] = []
  if (query.length < MIN_QUERY) return matches
  let at = text.folded.indexOf(query)
  while (at >= 0) {
    matches.push({ from: text.starts[at]!, to: text.ends[at + query.length - 1]! })
    at = text.folded.indexOf(query, at + query.length)
  }
  return matches
}

/**
 * Every match of `query` in `text`, ignoring case, accents, curly quotes, `…` for `...` and `—` for `--`. Nothing for
 * queries under `MIN_QUERY`.
 */
export function findText(text: string, query: string): FindMatch[] {
  return findFolded(foldText(text), foldQuery(query))
}
