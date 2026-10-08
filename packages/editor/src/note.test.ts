import { getSchema } from "@tiptap/core"
import { Fragment, Slice } from "@tiptap/pm/model"
import { EditorState } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"
import { chapterExtensions, noteRanges, stripNoteMarks, stripNotesFromSlice } from "./index"

const schema = getSchema(chapterExtensions)
const note = (id: string) => schema.marks.note!.create({ id })
const mia = schema.marks.author!.create({ userId: "mia", at: 1 })

function sentence(): EditorState {
  return EditorState.create({
    schema,
    doc: schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "The cat sat on the mat." }] }] }),
  })
}

/** Each text node as [text, note ids]. */
function runs(state: EditorState) {
  const out: [string, string[]][] = []
  state.doc.descendants((node) => {
    if (node.isText) out.push([node.text!, node.marks.filter((m) => m.type.name === "note").map((m) => m.attrs.id)])
  })
  return out
}

describe("note mark", () => {
  it("keeps both ids where Notes overlap", () => {
    let state = sentence()
    state = state.apply(state.tr.addMark(5, 12, note("a")))
    state = state.apply(state.tr.addMark(9, 19, note("b")))
    expect(runs(state)).toEqual([
      ["The ", []],
      ["cat ", ["a"]],
      ["sat", ["a", "b"]],
      [" on the", ["b"]],
      [" mat.", []],
    ])
    expect(() => state.doc.check()).not.toThrow()
  })

  it("doesn't grow when someone types at either edge", () => {
    let state = sentence()
    state = state.apply(state.tr.addMark(5, 8, note("a")))
    state = state.apply(state.tr.insertText("!", 8))
    state = state.apply(state.tr.insertText("!", 5))
    expect(runs(state)).toEqual([
      ["The !", []],
      ["cat", ["a"]],
      ["! sat on the mat.", []],
    ])
  })
})

describe("noteRanges", () => {
  it("spans from a Note's first piece to its last, across overlaps and splits", () => {
    let state = sentence()
    state = state.apply(state.tr.addMark(5, 12, note("a")))
    state = state.apply(state.tr.addMark(9, 19, note("b")))
    state = state.apply(state.tr.addMark(9, 12, schema.marks.bold!.create()))
    expect(noteRanges(state.doc)).toEqual(
      new Map([
        ["a", { from: 5, to: 12 }],
        ["b", { from: 9, to: 19 }],
      ])
    )
  })

  it("is empty for a doc without Notes", () => {
    expect(noteRanges(sentence().doc).size).toBe(0)
  })
})

describe("pasting", () => {
  it("drops note marks and keeps authors", () => {
    const slice = new Slice(Fragment.from(schema.text("cat", [mia, note("a")])), 0, 0)
    const pasted = stripNotesFromSlice(slice)
    expect(pasted.content.firstChild!.marks).toEqual([mia])
  })

  it("strips inside paragraphs too, keeping the slice open", () => {
    const paragraph = schema.nodes.paragraph!.create(null, schema.text("cat", [note("a")]))
    const pasted = stripNotesFromSlice(new Slice(Fragment.from(paragraph), 1, 1))
    expect(pasted.content.firstChild!.firstChild!.marks).toEqual([])
    expect([pasted.openStart, pasted.openEnd]).toEqual([1, 1])
  })
})

describe("stripNoteMarks", () => {
  it("removes note marks from JSON and leaves the rest", () => {
    const json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "cat", marks: [{ type: "author", attrs: { userId: "mia", at: 1 } }, { type: "note", attrs: { id: "a" } }] },
            { type: "text", text: " sat", marks: [{ type: "note", attrs: { id: "a" } }] },
          ],
        },
      ],
    }
    expect(stripNoteMarks(json)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "cat", marks: [{ type: "author", attrs: { userId: "mia", at: 1 } }] },
            { type: "text", text: " sat" },
          ],
        },
      ],
    })
  })
})
