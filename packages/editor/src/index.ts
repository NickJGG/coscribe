/** Shared Tiptap/ProseMirror schemas for Chapters, Entry bodies and Outlines. Used by the web editor and apps/sync. */
import { getSchema } from "@tiptap/core"
import Bold from "@tiptap/extension-bold"
import Document from "@tiptap/extension-document"
import Italic from "@tiptap/extension-italic"
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list"
import Paragraph from "@tiptap/extension-paragraph"
import Strike from "@tiptap/extension-strike"
import Text from "@tiptap/extension-text"
import { Author } from "./author"
import { Align, ChapterBlockquote, EntryBlockquote } from "./format"
import { LineBreak, LineBreakPaste } from "./hard-break"
import { Note, NotePaste } from "./note"
import { SceneBreak } from "./scene-break"
import { Script, ScriptElement } from "./script"

export { SceneBreak }
export {
  Script,
  ScriptElement,
  SCRIPT_ELEMENT_LABELS,
  SCRIPT_ELEMENTS,
  scriptCues,
  scriptEnter,
  scriptTab,
  type ScriptElementType,
} from "./script"
export { type Alignment } from "./format"
export { countAuthorCharacters, type ContentJSON } from "./credits"
export {
  diffDocuments,
  foldRows,
  listNumbers,
  type DocumentDiff,
  type DiffBlock,
  type DiffOp,
  type DiffRow,
  type DiffSegment,
  type Fold,
  type FoldItem,
} from "./diff"
export { findFolded, findText, foldQuery, foldText, MIN_QUERY, type FindMatch, type FoldedText } from "./find"
export {
  blockTexts,
  countEntryMentions,
  entryNameAt,
  entryNamed,
  findEntryMentions,
  type EntryMention,
  type EntryMentionTarget,
} from "./entry-mentions"
export { SmartPunctuation, smartenSlice, smartenText, type SmartPunctuationStorage } from "./smart-punctuation"
export { Author, AUTHOR_RUN_MS, AuthorStamp, IMPORTED_AUTHOR, authorStampPlugin, type AuthorAttrs } from "./author"
export {
  chapterIntro,
  expandSceneHeading,
  narratedBlocks,
  narrationUnits,
  sentences,
  THE_END,
  unitAt,
  type NarrationUnit,
} from "./narration"
export { FEATURE_MAX_CHARS, featureError, sliceChapter, type TextPoint } from "./passage"
export { Note, NotePaste, noteRanges, stripNoteMarks, stripNotesFromSlice, type NoteAttrs } from "./note"
export {
  addCharacter,
  addedFields,
  addField,
  discardField,
  fieldFragment,
  OUTLINE_FIELDS,
  outlineCharacters,
  outlineHasContent,
  removeCharacter,
  removeField,
  renameField,
  restoreField,
  type OutlineField,
  type RemovedField,
} from "./outline"

/**
 * Paragraphs (left, centered or right-aligned) that can hold line breaks, block quotes of paragraphs, Scene Breaks,
 * Scripts of Script Elements (a `scriptElement` with its kind in `element`, and no line breaks), and bold, italic and
 * strikethrough, plus the `author` mark on every run of text and `note` marks on noted passages. Every client
 * and apps/sync must share this schema: y-tiptap drops text carrying a mark it doesn't know.
 */
export const chapterExtensions = [
  Document,
  Paragraph,
  Text,
  LineBreak,
  LineBreakPaste,
  Bold,
  Italic,
  Strike,
  SceneBreak,
  ChapterBlockquote,
  Script,
  ScriptElement,
  Align,
  Author,
  Note,
  NotePaste,
]

/**
 * The shared schema's version. A client on a different one is read-only (see apps/sync), because
 * y-prosemirror deletes nodes it doesn't know from the shared document. Bump it whenever
 * `chapterExtensions`, `entryExtensions` or `outlineExtensions` gains or loses a node, mark or attribute.
 */
export const SCHEMA_VERSION = 4

/** Server-side (apps/sync) view of a Chapter, for Snapshot previews and Restores. */
export const chapterSchema = getSchema(chapterExtensions)

/** A Chapter's formatting, less Scripts, plus bulleted and numbered lists, which block quotes can hold too. */
export const entryExtensions = [
  ...chapterExtensions.filter(
    (extension) => extension !== ChapterBlockquote && extension !== Script && extension !== ScriptElement
  ),
  EntryBlockquote,
  BulletList,
  OrderedList,
  ListItem,
  ListKeymap,
]

/** Server-side (apps/sync) view of an Entry body, for the Reader View. */
export const entrySchema = getSchema(entryExtensions)

/** An Outline box: bold, italic, strikethrough and lists. No authorship, Notes or Scene Breaks. */
export const outlineExtensions = [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  Strike,
  BulletList,
  OrderedList,
  ListItem,
  ListKeymap,
]

/** Server-side (apps/sync) view of an Outline box. */
export const outlineSchema = getSchema(outlineExtensions)

/** The Yjs XmlFragment that holds the text (Tiptap Collaboration's default field). */
export const DOCUMENT_FIELD = "default"

export type DocumentKind = "chapter" | "entry" | "outline"

/** Hocuspocus document names: `chapter:<uuid>`, `entry:<uuid>` and `outline:<chapter uuid>`. */
export function documentName(kind: DocumentKind, id: string): string {
  return `${kind}:${id}`
}

const DOCUMENT_NAME = /^(chapter|entry|outline):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

export function parseDocumentName(name: string): { kind: DocumentKind; id: string } | null {
  const match = DOCUMENT_NAME.exec(name)
  return match ? { kind: match[1]!.toLowerCase() as DocumentKind, id: match[2]! } : null
}

/** Words in a Chapter or Entry body; paragraphs never run together. */
export function countWords(doc: {
  content: { size: number }
  textBetween(from: number, to: number, blockSeparator: string, leafText: string): string
}): number {
  return doc.textBetween(0, doc.content.size, "\n", "\n").match(/\S+/gu)?.length ?? 0
}

/** Close reason apps/sync sends when a connection loses all access (removed, story made Private or deleted). */
export const ACCESS_REVOKED = "access-revoked"

/** Close reason apps/sync sends when a connection's Chapter or Entry (or an Outline's Chapter) moves to the Trash. */
export const DOCUMENT_TRASHED = "document-trashed"

/** Stateless message apps/sync sends when a connection's edit rights change (lock, unlock). */
export type AccessMessage = { type: "access"; readOnly: boolean }

/** Stateless message apps/sync sends Chapter and Entry connections when taking a Snapshot would (or wouldn't) save anything. */
export type SnapshotMessage = { type: "snapshot"; changed: boolean; empty: boolean }

/** Stateless message apps/sync sends a connection whose SCHEMA_VERSION isn't its own; it stays read-only. */
export type OutdatedMessage = { type: "outdated" }

export type SyncMessage = AccessMessage | SnapshotMessage | OutdatedMessage
