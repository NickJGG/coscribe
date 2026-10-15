import type { JSONContent } from "@tiptap/core"
import { Slice } from "@tiptap/pm/model"
import { splitBlockKeepMarks } from "@tiptap/pm/commands"
import { EditorState, TextSelection, type Command, type Transaction } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"
import { chapterSchema } from "./index"
import { AUTHOR_RUN_MS, authorStampPlugin } from "./author"
import { smartenSlice, smartenText, smartInput, smartPunctuationPlugin, undoSmartPunctuation } from "./smart-punctuation"

const text = (t: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text: t, ...(marks && { marks }) })
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", ...(content.length && { content }) })

const mia = [{ type: "author", attrs: { userId: "mia", at: Date.now() } }]

/**
 * An editor without a DOM: typing goes through the plugin's `handleTextInput` as ProseMirror's would, and
 * `state.apply` runs authorStamp's `appendTransaction` on it.
 */
function editor(content: JSONContent[], pos: number, enabled = true) {
  const doc = chapterSchema.nodeFromJSON({ type: "doc", content })
  const plugin = smartPunctuationPlugin({ enabled })
  const view = {
    state: EditorState.create({
      doc,
      selection: TextSelection.create(doc, pos),
      plugins: [authorStampPlugin("me"), plugin],
    }),
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr)
    },
  }
  return {
    view,
    type(chars: string) {
      for (const ch of chars) {
        const { from, to } = view.state.selection
        const deflt = () => view.state.tr.insertText(ch, from, to)
        if (!plugin.props.handleTextInput!.call(plugin, view as never, from, to, ch, deflt)) view.dispatch(deflt())
      }
    },
    backspace() {
      if (undoSmartPunctuation(view.state, view.dispatch)) return
      const { head } = view.state.selection
      view.dispatch(view.state.tr.delete(head - 1, head))
    },
    run(command: Command) {
      command(view.state, view.dispatch)
    },
    texts: () => view.state.doc.children.map((block) => block.textContent),
    authorAt(pos: number) {
      const node = view.state.doc.resolve(pos).nodeAfter!
      return node.marks.find((m) => m.type.name === "author")?.attrs.userId as string | undefined
    },
  }
}

const typed = (chars: string, enabled = true) => {
  const e = editor([p()], 1, enabled)
  e.type(chars)
  return e.texts()[0]
}

describe("smartenText", () => {
  it("curls quotes by what comes before them", () => {
    expect(smartenText(`"Wait," she said. 'Don't.'`)).toBe("“Wait,” she said. ‘Don’t.’")
    expect(smartenText(`("Hi") —"so" "'Tis"`)).toBe("(“Hi”) —“so” “‘Tis”")
  })

  it("takes the character before the text into account", () => {
    expect(smartenText(`"`, "a")).toBe("”")
    expect(smartenText(`"`, " ")).toBe("“")
    expect(smartenText(`"`)).toBe("“")
  })

  it("turns -- into an em dash and ... into an ellipsis", () => {
    expect(smartenText("Wait... she said -- no.")).toBe("Wait… she said — no.")
    expect(smartenText("---- ....")).toBe("—— ….")
  })
})

describe("smartenSlice", () => {
  it("carries the previous character across marks and line breaks within a paragraph", () => {
    const doc = chapterSchema.nodeFromJSON({
      type: "doc",
      content: [p(text("say "), text('"hi', [{ type: "bold" }]), text('"'), { type: "hardBreak" }, text(`'yo'`))],
    })
    const out = smartenSlice(new Slice(doc.content, 0, 0))
    expect(out.content.firstChild!.textContent).toBe("say “hi”\n‘yo’")
    expect(out.content.firstChild!.child(1).marks.map((m) => m.type.name)).toEqual(["bold"])
  })

  it("starts each paragraph afresh, but an open slice from the caret", () => {
    const doc = chapterSchema.nodeFromJSON({ type: "doc", content: [p(text(`"a`)), p(text(`"b`))] })
    const texts = (slice: Slice) => slice.content.textBetween(0, slice.content.size, "|")
    expect(texts(smartenSlice(new Slice(doc.content, 1, 1), "x"))).toBe("”a|“b")
    expect(texts(smartenSlice(new Slice(doc.content, 0, 0), "x"))).toBe("“a|“b")
  })
})

describe("smartInput", () => {
  it("curls quotes by the character before them", () => {
    expect(smartInput("", '"')).toEqual({ replace: 0, insert: "“" })
    expect(smartInput("a ", "'")).toEqual({ replace: 0, insert: "‘" })
    expect(smartInput("ab", '"')).toEqual({ replace: 0, insert: "”" })
  })

  it("joins -- and ... and leaves other input alone", () => {
    expect(smartInput("a-", "-")).toEqual({ replace: 1, insert: "—" })
    expect(smartInput("..", ".")).toEqual({ replace: 2, insert: "…" })
    expect(smartInput("—", "-")).toBeNull()
    expect(smartInput("a.", ".")).toBeNull()
    expect(smartInput("", '""')).toBeNull()
  })
})

describe("SmartPunctuation", () => {
  it("smartens as you type", () => {
    expect(typed(`"Wait..." she said -- 'Don't.'`)).toBe("“Wait…” she said — ‘Don’t.’")
  })

  it("leaves --- as the em dash and hyphen the Scene Break rule accepts", () => {
    expect(typed("---")).toBe("—-")
  })

  it("does nothing while off", () => {
    expect(typed(`"a" -- ...`, false)).toBe(`"a" -- ...`)
  })

  it("curls a quote that authorStamp stamps, wherever it's typed", () => {
    const old = [{ type: "author", attrs: { userId: "me", at: Date.now() - AUTHOR_RUN_MS - 1 } }]
    const cases = [
      { content: [p()], pos: 1, want: "“Hale?”" },
      { content: [p(text("she said ", mia))], pos: 10, want: "she said “Hale?”" },
      { content: [p(text("said.", mia))], pos: 1, want: "“Hale?”said." },
      { content: [p(text("I said ", old))], pos: 8, want: "I said “Hale?”" },
      { content: [p(text("said", mia), { type: "hardBreak" })], pos: 6, want: "said\n“Hale?”" },
    ]
    for (const { content, pos, want } of cases) {
      const e = editor(content, pos)
      e.type(`"Hale?"`)
      expect(e.texts()[0]).toBe(want)
      expect(e.authorAt(pos)).toBe("me")
    }
  })

  it("curls a quote in a new paragraph after Enter at the end of another Writer's", () => {
    const e = editor([p(text("said.", mia))], 6)
    e.run(splitBlockKeepMarks)
    expect(e.view.state.storedMarks?.[0]?.attrs.userId).toBe("mia")
    e.type(`"Hale?"`)
    expect(e.texts()).toEqual(["said.", "“Hale?”"])
    expect(e.authorAt(8)).toBe("me")
  })

  it("undoes a conversion with Backspace right after it, and only then", () => {
    const e = editor([p(text("said ", mia))], 6)
    e.type(`"`)
    e.backspace()
    expect(e.texts()[0]).toBe(`said "`)
    e.backspace()
    expect(e.texts()[0]).toBe("said ")

    e.type("a--")
    e.backspace()
    expect(e.texts()[0]).toBe("said a--")

    e.type("...")
    e.type("b")
    e.backspace()
    expect(e.texts()[0]).toBe("said a--…")
  })
})
