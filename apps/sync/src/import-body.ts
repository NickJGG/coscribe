import type * as Y from "yjs"
import {
  addCharacter,
  addField,
  chapterSchema,
  entrySchema,
  fieldFragment,
  OUTLINE_FIELDS,
  outlineSchema,
} from "@coscribe/editor"
import { replaceChapterContent, type ChapterContent } from "./chapter-content"

type Node = ChapterContent

const ENTRY_TYPES = ["character", "place", "item", "lore"] as const

export type EntryType = (typeof ENTRY_TYPES)[number]

export type ImportOutline = { fields: { label: string; content: Node }[]; characters: string[] }

/** A `POST /stories/<id>/import` body with every document parsed and checked against its schema. */
export type ImportBody = {
  userId: string
  chapters: { title: string; content: Node; outline?: ImportOutline }[]
  entries: { type: EntryType; name: string; description: string; aliases: string[]; body: Node }[]
}

const MAX_CHAPTERS = 500

/** The body, or null if anything in it breaks a schema or the tables' limits. */
export function parseImportBody(body: Record<string, unknown> | null): ImportBody | null {
  try {
    if (!body || typeof body.userId !== "string" || !Array.isArray(body.chapters) || !Array.isArray(body.entries)) {
      return null
    }
    if (!body.chapters.length || body.chapters.length > MAX_CHAPTERS) return null
    const chapters = list<Record<string, unknown>>(body.chapters).map((raw) => {
      const outline = raw.outline as { fields?: unknown; characters?: unknown } | undefined
      return {
        title: text(raw.title, 1, 120),
        content: node(raw.content, chapterSchema),
        ...(outline && {
          outline: {
            fields: list<Record<string, unknown>>(outline.fields).map((field) => ({
              label: text(field.label, 1, 120),
              content: node(field.content, outlineSchema),
            })),
            characters: list(outline.characters).map((name) => text(name, 1, 80)),
          },
        }),
      }
    })
    const entries = list<Record<string, unknown>>(body.entries).map((raw) => {
      const aliases = list(raw.aliases).map((alias) => text(alias, 1, 80))
      if (aliases.length > 20 || !ENTRY_TYPES.includes(raw.type as EntryType)) throw new Error("bad entry")
      return {
        type: raw.type as EntryType,
        name: text(raw.name, 1, 80),
        description: text(raw.description ?? "", 0, 280),
        aliases,
        body: node(raw.body, entrySchema),
      }
    })
    return { userId: body.userId, chapters, entries }
  } catch {
    return null
  }
}

function text(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw new Error("not text")
  // In characters, as Postgres's char_length counts them.
  const length = [...value.trim()].length
  if (length < min || length > max) throw new Error("bad length")
  return value.trim()
}

function list<T = unknown>(value: unknown): T[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error("not a list")
  return value as T[]
}

function node(json: unknown, schema: typeof chapterSchema): Node {
  const doc = schema.nodeFromJSON(json)
  doc.check()
  return doc
}

/**
 * Writes an Outline into an empty Outline doc: a field whose label matches a default (ignoring case) fills that box,
 * any other becomes an added field. Characters are Entry names, kept when they name one of `characterIds`.
 */
export function writeOutline(doc: Y.Doc, outline: ImportOutline, characterIds: ReadonlyMap<string, string>): void {
  for (const { label, content } of outline.fields) {
    const id = OUTLINE_FIELDS.find((f) => f.label.toLowerCase() === label.toLowerCase())?.id ?? addField(doc, label)
    replaceChapterContent(doc, content, fieldFragment(id))
  }
  for (const name of outline.characters) {
    const id = characterIds.get(name.toLowerCase())
    if (id) addCharacter(doc, id)
  }
}
