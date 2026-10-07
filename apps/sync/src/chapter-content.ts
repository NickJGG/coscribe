import { createHash } from "node:crypto"
import { updateYFragment, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap"
import * as Y from "yjs"
import { chapterSchema, DOCUMENT_FIELD } from "@coscribe/editor"

export type ChapterContent = ReturnType<typeof yXmlFragmentToProseMirrorRootNode>

export function chapterContent(doc: Y.Doc): ChapterContent {
  return yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(DOCUMENT_FIELD), chapterSchema)
}

export function decodeChapter(state: Uint8Array): ChapterContent {
  const doc = new Y.Doc()
  try {
    Y.applyUpdate(doc, state)
    return chapterContent(doc)
  } finally {
    doc.destroy()
  }
}

/** Equal for equal text, formatting, and `author` marks, whatever edits led there. */
export function contentHash(content: ChapterContent): string {
  return createHash("sha256").update(JSON.stringify(content.toJSON())).digest("hex")
}

/** Rewrites the doc to `target` as a diff, so unchanged paragraphs (and carets in them) stay put. */
export function replaceChapterContent(doc: Y.Doc, target: ChapterContent): void {
  updateYFragment(doc, doc.getXmlFragment(DOCUMENT_FIELD), target, { mapping: new Map(), isOMark: new Map() })
}
