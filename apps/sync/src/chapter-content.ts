import { createHash } from "node:crypto"
import { updateYFragment, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap"
import * as Y from "yjs"
import { chapterSchema, countAuthorCharacters, countWords, DOCUMENT_FIELD, entrySchema, type DocumentKind } from "@coscribe/editor"

export type ChapterContent = ReturnType<typeof yXmlFragmentToProseMirrorRootNode>

const SCHEMA = { chapter: chapterSchema, entry: entrySchema } satisfies Record<DocumentKind, unknown>

export function chapterContent(doc: Y.Doc, kind: DocumentKind = "chapter"): ChapterContent {
  return yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(DOCUMENT_FIELD), SCHEMA[kind])
}

export function decodeChapter(state: Uint8Array, kind: DocumentKind = "chapter"): ChapterContent {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, state)
    return chapterContent(doc, kind)
  } finally {
    doc.destroy()
  }
}

/** Equal for equal text, formatting, and `author` marks, whatever edits led there. */
export function contentHash(content: ChapterContent): string {
  return createHash("sha256").update(JSON.stringify(content.toJSON())).digest("hex")
}

export type ChapterStats = { words: number; authorChars: Record<string, number> }

/** Word count, plus surviving characters per author (the tally Credits uses). */
export function chapterStats(content: ChapterContent): ChapterStats {
  return {
    words: countWords(content),
    authorChars: Object.fromEntries(countAuthorCharacters(content.toJSON())),
  }
}

/** Rewrites the doc to `target` as a diff, so unchanged paragraphs (and carets in them) stay put. */
export function replaceChapterContent(doc: Y.Doc, target: ChapterContent): void {
  updateYFragment(doc, doc.getXmlFragment(DOCUMENT_FIELD), target, { mapping: new Map(), isOMark: new Map() })
}
