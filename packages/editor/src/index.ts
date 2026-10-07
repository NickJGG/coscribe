/** Shared Tiptap/ProseMirror schema for Chapters (and, later, Entries). Used by the web editor and apps/sync. */
import Bold from "@tiptap/extension-bold"
import Document from "@tiptap/extension-document"
import Italic from "@tiptap/extension-italic"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { SceneBreak } from "./scene-break"

export { SceneBreak }

/** Paragraphs, italic, bold, and Scene Breaks only. */
export const chapterExtensions = [Document, Paragraph, Text, Bold, Italic, SceneBreak]

/** Hocuspocus document names. */
export function chapterDocumentName(chapterId: string): string {
  return `chapter:${chapterId}`
}

const DOCUMENT_NAME = /^chapter:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function parseDocumentName(name: string): { kind: "chapter"; id: string } | null {
  const match = DOCUMENT_NAME.exec(name)
  return match ? { kind: "chapter", id: match[1]! } : null
}

/** Close reason apps/sync sends when a connection loses all access (removed, story made Private, Chapter deleted). */
export const ACCESS_REVOKED = "access-revoked"

/** Stateless message apps/sync sends when a connection's edit rights change (lock, unlock). */
export type AccessMessage = { type: "access"; readOnly: boolean }
