/**
 * A Chapter's Outline, in one Yjs document (`outline:<chapterId>`):
 * - `field:<id>` XmlFragments, one per box: the defaults below, then any added fields.
 * - `fields`: the added fields, in order, as Y.Maps of `{ id, label }`.
 * - `characters`: Character Entry ids.
 *
 * Removing an added field leaves its fragment, so Undo can bring the text back; `discardField` clears it
 * once Undo is no longer offered.
 */
import * as Y from "yjs"

export type OutlineField = { id: string; label: string }

export type RemovedField = { field: OutlineField; index: number }

export const OUTLINE_FIELDS: readonly OutlineField[] = [
  { id: "summary", label: "Summary" },
  { id: "development", label: "Character development" },
  { id: "plot", label: "Plot progression" },
  { id: "subplots", label: "Subplots and themes" },
  { id: "foreshadowing", label: "Foreshadowing and setups" },
  { id: "resolution", label: "Resolution" },
]

export function fieldFragment(id: string): string {
  return `field:${id}`
}

function fieldsArray(doc: Y.Doc): Y.Array<Y.Map<string>> {
  return doc.getArray("fields")
}

function toField(map: Y.Map<string>): OutlineField {
  return { id: map.get("id") ?? "", label: map.get("label") ?? "" }
}

function fieldMap(field: OutlineField): Y.Map<string> {
  return new Y.Map(Object.entries(field))
}

export function addedFields(doc: Y.Doc): OutlineField[] {
  return fieldsArray(doc).map(toField)
}

/** Appends a field and returns its id. */
export function addField(doc: Y.Doc, label: string): string {
  const id = Math.random().toString(36).slice(2, 10)
  fieldsArray(doc).push([fieldMap({ id, label })])
  return id
}

export function removeField(doc: Y.Doc, id: string): RemovedField | null {
  const fields = fieldsArray(doc)
  const index = fields.toArray().findIndex((map) => map.get("id") === id)
  if (index < 0) return null
  const field = toField(fields.get(index))
  fields.delete(index)
  return { field, index }
}

export function restoreField(doc: Y.Doc, { field, index }: RemovedField): void {
  const fields = fieldsArray(doc)
  if (fields.toArray().some((map) => map.get("id") === field.id)) return
  fields.insert(Math.min(index, fields.length), [fieldMap(field)])
}

export function discardField(doc: Y.Doc, id: string): void {
  if (addedFields(doc).some((field) => field.id === id)) return
  const fragment = doc.getXmlFragment(fieldFragment(id))
  fragment.delete(0, fragment.length)
}

function hasText(node: Y.XmlFragment | Y.XmlElement | Y.XmlText | Y.XmlHook): boolean {
  if (node instanceof Y.XmlText) return node.length > 0
  if (node instanceof Y.XmlHook) return false
  return node.toArray().some(hasText)
}

export function outlineHasContent(doc: Y.Doc): boolean {
  if (doc.getArray("characters").length > 0) return true
  const ids = [...OUTLINE_FIELDS, ...addedFields(doc)].map((field) => field.id)
  return ids.some((id) => hasText(doc.getXmlFragment(fieldFragment(id))))
}
