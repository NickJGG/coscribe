import type { JSONContent } from "@tiptap/core"
import { countAuthorCharacters } from "./credits"

/**
 * A place in a Chapter: a top-level block's index, and a UTF-16 offset into that block's text. A block
 * quote's text is its paragraphs' run together, and a Script's its lines'.
 */
export type TextPoint = { block: number; offset: number }

export const FEATURE_MAX_CHARS = 500

/**
 * The top-level blocks of `doc` between two points (in either order), cut to the points. Text keeps its
 * marks (including `author`) and paragraphs stay separate. Blocks left with no text at either end are dropped,
 * and so are a block quote's paragraphs or a Script's lines outside the points.
 */
export function sliceChapter(doc: JSONContent, a: TextPoint, b: TextPoint): JSONContent {
  const [from, to] = before(a, b) ? [a, b] : [b, a]
  const blocks = (doc.content ?? []).slice(from.block, to.block + 1).map((node, i) => {
    const index = from.block + i
    const start = index === from.block ? from.offset : 0
    const end = index === to.block ? to.offset : Infinity
    return node.content ? cut(node, start, end).node : node
  })
  while (blocks.length && !hasText(blocks[0]!)) blocks.shift()
  while (blocks.length && !hasText(blocks.at(-1)!)) blocks.pop()
  return { type: "doc", content: blocks }
}

/** Why `slice` can't be featured by `userId`, or null if it can. */
export function featureError(slice: JSONContent, userId: string): string | null {
  if ([...textOf(slice)].length > FEATURE_MAX_CHARS) return "Too long to feature. Keep it under 500 characters."
  if (!countAuthorCharacters(slice).get(userId)) return "Select some of your own writing to feature it."
  return null
}

function before(a: TextPoint, b: TextPoint): boolean {
  return a.block < b.block || (a.block === b.block && a.offset <= b.offset)
}

/** `node` keeping only the text between `start` and `end` of its own text, and how much text it had. */
function cut(node: JSONContent, start: number, end: number): { node: JSONContent; length: number } {
  if (node.text !== undefined) {
    const length = node.text.length
    return { node: { ...node, text: node.text.slice(Math.max(0, start), Math.max(0, end)) }, length }
  }
  let at = 0
  const content: JSONContent[] = []
  for (const child of node.content ?? []) {
    const { node: kept, length } = cut(child, start - at, end - at)
    const outside = at + length <= start || at >= end
    at += length
    if (kept.text === "" || (outside && !hasText(kept))) continue
    content.push(kept)
  }
  const kept: JSONContent = { ...node, content }
  if (!content.length) delete kept.content
  return { node: kept, length: at }
}

function hasText(node: JSONContent): boolean {
  return textOf(node) !== ""
}

function textOf(node: JSONContent): string {
  return (node.text ?? "") + (node.content ?? []).map(textOf).join("")
}
