import { getSchema } from "@tiptap/core"
import { Fragment, Slice } from "@tiptap/pm/model"
import { EditorState } from "@tiptap/pm/state"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AUTHOR_RUN_MS, authorStampPlugin, chapterExtensions } from "./index"

const schema = getSchema(chapterExtensions)
const MIA = "mia-id"
const JORDAN = "jordan-id"
const T0 = new Date("2026-10-07T12:00:00Z").getTime()

function as(userId: string, from?: EditorState): EditorState {
  return EditorState.create({
    schema,
    doc: from?.doc ?? schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph" }] }),
    plugins: [authorStampPlugin(userId)],
  })
}

/** Each text node as [text, author userId, author at]. */
function runs(state: EditorState) {
  const out: [string, string | null, number | null][] = []
  state.doc.descendants((node) => {
    if (!node.isText) return
    const mark = node.marks.find((m) => m.type.name === "author")
    out.push([node.text!, mark?.attrs.userId ?? null, mark?.attrs.at ?? null])
  })
  return out
}

function type(state: EditorState, text: string, at = state.selection.from): EditorState {
  for (const char of text) {
    state = state.apply(state.tr.insertText(char, at))
    at++
  }
  return state
}

/** Mia types "The cat sat." into an empty Chapter. */
function miasSentence(): EditorState {
  return type(as(MIA), "The cat sat.", 1)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("authorStampPlugin", () => {
  it("stamps typed text with the local user, as one run", () => {
    expect(runs(miasSentence())).toEqual([["The cat sat.", MIA, T0]])
  })

  it("starts a new run once the user's run is older than the window", () => {
    let state = miasSentence()
    vi.setSystemTime(T0 + AUTHOR_RUN_MS + 1)
    state = type(state, " Then", state.doc.content.size - 1)
    expect(runs(state)).toEqual([
      ["The cat sat.", MIA, T0],
      [" Then", MIA, T0 + AUTHOR_RUN_MS + 1],
    ])
  })

  it("gives a replaced word to the replacer and leaves the rest alone", () => {
    let state = as(JORDAN, miasSentence())
    vi.setSystemTime(T0 + 1000)
    state = state.apply(state.tr.insertText("dog", 5, 8))
    expect(runs(state)).toEqual([
      ["The ", MIA, T0],
      ["dog", JORDAN, T0 + 1000],
      [" sat.", MIA, T0],
    ])
  })

  it("extends an adjacent run of the user's own instead of starting a new mark", () => {
    let state = as(JORDAN, miasSentence())
    vi.setSystemTime(T0 + 1000)
    state = state.apply(state.tr.insertText("dog", 5, 8))
    vi.setSystemTime(T0 + 2000)
    state = state.apply(state.tr.insertText(" ran", 8, 12))
    expect(runs(state)).toEqual([
      ["The ", MIA, T0],
      ["dog ran", JORDAN, T0 + 1000],
      [".", MIA, T0],
    ])
  })

  it("keeps the author when another user formats the text", () => {
    let state = as(JORDAN, miasSentence())
    state = state.apply(state.tr.addMark(1, 4, schema.marks.bold!.create()))
    expect(runs(state).map(([text, userId]) => [text, userId])).toEqual([
      ["The", MIA],
      [" cat sat.", MIA],
    ])
  })

  it.each([
    ["remote edits", { isChangeOrigin: true }],
    ["undo and redo", { isChangeOrigin: true, isUndoRedoOperation: true }],
  ])("never stamps %s from Yjs", (_name, meta) => {
    let state = as(JORDAN, miasSentence())
    state = state.apply(state.tr.insert(5, schema.text("big ")).setMeta("y-sync$", meta))
    expect(runs(state).map(([, userId]) => userId)).toEqual([MIA, null, MIA])
  })

  it("keeps the authors of pasted text and stamps only unmarked text", () => {
    const miaMark = schema.marks.author!.create({ userId: MIA, at: T0 })
    const slice = new Slice(Fragment.from([schema.text("Mia's", [miaMark]), schema.text(" and mine")]), 0, 0)
    let state = as(JORDAN)
    state = state.apply(state.tr.replaceSelection(slice).setMeta("uiEvent", "paste"))
    expect(runs(state).map(([text, userId]) => [text, userId])).toEqual([
      ["Mia's", MIA],
      [" and mine", JORDAN],
    ])
  })

  it("restamps typed text that inherited someone else's mark", () => {
    let state = as(JORDAN, miasSentence())
    state = type(state, "!", state.doc.content.size - 1)
    expect(runs(state).map(([text, userId]) => [text, userId])).toEqual([
      ["The cat sat.", MIA],
      ["!", JORDAN],
    ])
  })
})
