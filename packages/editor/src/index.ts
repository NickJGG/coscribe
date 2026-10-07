/** Shared Tiptap/ProseMirror schemas for Chapters and Entry bodies. Used by the web editor and apps/sync. */
import { getSchema } from "@tiptap/core"
import Bold from "@tiptap/extension-bold"
import Document from "@tiptap/extension-document"
import Italic from "@tiptap/extension-italic"
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { Author } from "./author"
import { SceneBreak } from "./scene-break"

export { SceneBreak }
export { Author, AUTHOR_RUN_MS, AuthorStamp, authorStampPlugin, type AuthorAttrs } from "./author"

/** Paragraphs, italic, bold, and Scene Breaks only, plus the `author` mark on every run of text. */
export const chapterExtensions = [Document, Paragraph, Text, Bold, Italic, SceneBreak, Author]

/** Server-side (apps/sync) view of a Chapter, for Snapshot previews and Restores. */
export const chapterSchema = getSchema(chapterExtensions)

/** A Chapter's formatting plus bulleted and numbered lists. */
export const entryExtensions = [...chapterExtensions, BulletList, OrderedList, ListItem, ListKeymap]

/** The Yjs XmlFragment that holds the text (Tiptap Collaboration's default field). */
export const DOCUMENT_FIELD = "default"

export type DocumentKind = "chapter" | "entry"

/** Hocuspocus document names: `chapter:<uuid>` and `entry:<uuid>`. */
export function documentName(kind: DocumentKind, id: string): string {
  return `${kind}:${id}`
}

const DOCUMENT_NAME = /^(chapter|entry):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function parseDocumentName(name: string): { kind: DocumentKind; id: string } | null {
  const match = DOCUMENT_NAME.exec(name)
  return match ? { kind: match[1]!.toLowerCase() as DocumentKind, id: match[2]! } : null
}

/** Close reason apps/sync sends when a connection loses all access (removed, story made Private, document deleted). */
export const ACCESS_REVOKED = "access-revoked"

/** Stateless message apps/sync sends when a connection's edit rights change (lock, unlock). */
export type AccessMessage = { type: "access"; readOnly: boolean }
