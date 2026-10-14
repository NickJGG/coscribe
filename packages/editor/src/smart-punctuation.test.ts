import type { JSONContent } from "@tiptap/core"
import { Slice } from "@tiptap/pm/model"
import { EditorState } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"
import { chapterSchema } from "./index"
import { SmartPunctuation, smartenSlice, smartenText } from "./smart-punctuation"

const text = (t: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text: t, ...(marks && { marks }) })
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content })

/**
 * `chars` typed one at a time through SmartPunctuation's input rules, the way Tiptap runs them: the first rule
 * matching the text up to the caret replaces its match. (Tiptap's own runner needs a DOM.)
 */
function typed(chars: string, enabled = true) {
  const rules = SmartPunctuation.config.addInputRules!.call({ storage: { enabled } } as never)
  let t = ""
  for (const ch of chars) {
    t += ch
    const rule = rules.find((r) => (r.find as RegExp).test(t))
    if (!rule) continue
    const match = (rule.find as RegExp).exec(t)!
    const { tr } = EditorState.create({ doc: chapterSchema.nodeFromJSON({ type: "doc", content: [p(text(t))] }) })
    const range = { from: 1 + t.length - match[0].length, to: 1 + t.length }
    if (rule.handler({ state: { tr }, range, match } as never) !== null) t = tr.doc.textContent
  }
  return t
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
})
