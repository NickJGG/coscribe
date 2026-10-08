import { Extension, Mark } from "@tiptap/core"
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import type { ContentJSON } from "./credits"

export type NoteAttrs = { id: string }

/**
 * Anchors a Note (stored in Postgres under the same id) to a passage. Notes may overlap, so the mark
 * doesn't exclude itself, and typing at either edge stays outside it.
 */
export const Note = Mark.create({
  name: "note",
  excludes: "",
  inclusive: false,

  addAttributes() {
    // The id lives in the Yjs doc only, never in rendered or copied HTML.
    return { id: { default: null, rendered: false } }
  },

  renderHTML() {
    return ["span", { "data-note": "" }, 0]
  },
})

function withoutNotes(fragment: Fragment): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    nodes.push(
      node.isText
        ? node.mark(node.marks.filter((m) => m.type.name !== "note"))
        : node.copy(withoutNotes(node.content))
    )
  })
  return Fragment.from(nodes)
}

/** A pasted or dropped slice minus its `note` marks, so a copied passage doesn't join the original's Note. */
export function stripNotesFromSlice(slice: Slice): Slice {
  return new Slice(withoutNotes(slice.content), slice.openStart, slice.openEnd)
}

export const NotePaste = Extension.create({
  name: "notePaste",

  addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey("notePaste"), props: { transformPasted: stripNotesFromSlice } })]
  },
})

/** Each Note's passage, from the start of its first span to the end of its last. */
export function noteRanges(doc: PMNode): Map<string, { from: number; to: number }> {
  const ranges = new Map<string, { from: number; to: number }>()
  doc.descendants((node, pos) => {
    if (!node.isText) return
    for (const mark of node.marks) {
      if (mark.type.name !== "note" || typeof mark.attrs.id !== "string") continue
      const end = pos + node.nodeSize
      const range = ranges.get(mark.attrs.id)
      if (range) range.to = end
      else ranges.set(mark.attrs.id, { from: pos, to: end })
    }
  })
  return ranges
}

/** `json` without `note` marks, for content served outside the story's members (the Reader View). */
export function stripNoteMarks<T extends ContentJSON>(json: T): T {
  const out: ContentJSON = { ...json }
  if (json.marks) {
    const marks = json.marks.filter((m) => m.type !== "note")
    if (marks.length) out.marks = marks
    else delete out.marks
  }
  if (json.content) out.content = json.content.map(stripNoteMarks)
  return out as T
}
