import { Editor, type JSONContent } from "@tiptap/core"
import { Fragment, Slice } from "@tiptap/pm/model"
import { TextSelection, type Command } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"
import { AuthorStamp, chapterExtensions, scriptCues, type ScriptElementType } from "./index"
import { sceneHeadingRule, scriptBackspace, scriptEnter, scriptShiftEnter, scriptShiftTab, scriptSlice, scriptTab } from "./script"

const text = (t: string, marks?: JSONContent["marks"]): JSONContent => ({ type: "text", text: t, ...(marks && { marks }) })
const p = (t = ""): JSONContent => ({ type: "paragraph", ...(t && { content: [text(t)] }) })
const line = (element: ScriptElementType, t = ""): JSONContent => ({
  type: "scriptElement",
  attrs: { element },
  ...(t && { content: [text(t)] }),
})
const script = (...lines: JSONContent[]): JSONContent => ({ type: "script", content: lines })
const br: JSONContent = { type: "hardBreak" }

/** A headless editor, with its plugins (which only load on mount) added by hand. */
function editor(...content: JSONContent[]): Editor {
  const e = new Editor({
    element: null,
    extensions: [...chapterExtensions, AuthorStamp.configure({ userId: "me" })],
    content: { type: "doc", content },
  })
  e.view.updateState(e.state.reconfigure({ plugins: e.extensionManager.plugins }))
  return e
}

/** Paragraphs as `"text"`, Scripts as `["element:text", ...]`. */
function shape(e: Editor): unknown[] {
  const out: unknown[] = []
  e.state.doc.forEach((node) => {
    if (node.type.name === "script") {
      const lines: string[] = []
      node.forEach((l) => lines.push(`${l.attrs.element}:${l.textContent}`))
      out.push(lines)
    } else {
      out.push(node.textContent)
    }
  })
  return out
}

/** Puts the caret `offset` characters into the `n`th textblock (-1 for its end). */
function caret(e: Editor, n: number, offset: number) {
  let found = -1
  let i = 0
  e.state.doc.descendants((node, pos) => {
    if (found >= 0) return false
    if (!node.isTextblock) return true
    if (i++ === n) found = pos + 1 + (offset < 0 ? node.content.size : offset)
    return false
  })
  e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, found)))
}

/** The caret as [textblock index, offset]. */
function where(e: Editor): [number, number] {
  const { $from } = e.state.selection
  let n = -1
  e.state.doc.nodesBetween(0, $from.pos, (node) => {
    if (node.isTextblock) n++
    return !node.isTextblock
  })
  return [n, $from.parentOffset]
}

const run = (e: Editor, command: Command) => command(e.state, e.view.dispatch)

describe("chapter schema with Scripts", () => {
  it("keeps Scene Breaks, block quotes and paragraphs out of a Script", () => {
    const { schema } = editor(p())
    for (const inner of [{ type: "sceneBreak" }, { type: "blockquote", content: [p("x")] }, p("x")]) {
      expect(() => schema.nodeFromJSON({ type: "doc", content: [script(line("action", "a"), inner)] }).check()).toThrow()
    }
    expect(() => schema.nodeFromJSON({ type: "doc", content: [line("action", "a")] }).check()).toThrow()
  })
})

describe("toggleScript", () => {
  it("turns paragraphs into Action lines of one Script, joining a Script beside them, and back", () => {
    const e = editor(p("Rain."), p("Thunder."), script(line("character", "MIA")))
    e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, 2, 10)))
    e.commands.toggleScript()
    expect(shape(e)).toEqual([["action:Rain.", "action:Thunder.", "character:MIA"]])

    caret(e, 1, 2)
    e.commands.toggleScript()
    expect(shape(e)).toEqual([["action:Rain."], "Thunder.", ["character:MIA"]])
    expect(where(e)).toEqual([1, 2])
  })

  it("leaves other Writers' text theirs", () => {
    const mia = [{ type: "author", attrs: { userId: "mia", at: 1 } }]
    const e = editor({ type: "paragraph", content: [text("Rain.", mia)] })
    caret(e, 0, 1)
    e.commands.toggleScript()
    const author = (i: number) => e.state.doc.firstChild!.firstChild!.child(i).marks[0]!.attrs.userId
    expect(author(0)).toBe("mia")
    e.view.dispatch(e.state.tr.insertText("!", e.state.doc.content.size - 2))
    expect(author(1)).toBe("me")
  })

  it("makes each line of a paragraph with line breaks its own Action line, keeping authorship", () => {
    const mia = [{ type: "author", attrs: { userId: "mia", at: 1 } }]
    const e = editor(p("Before."), { type: "paragraph", content: [text("Rain.", mia), br, text("Thunder.", mia), br, text("Hail.", mia)] })
    caret(e, 1, 1)
    e.commands.toggleScript()
    expect(shape(e)).toEqual(["Before.", ["action:Rain.", "action:Thunder.", "action:Hail."]])
    e.state.doc.child(1).forEach((l) => expect(l.firstChild!.marks[0]!.attrs.userId).toBe("mia"))
  })

  it("won't wrap a block quote", () => {
    const e = editor({ type: "blockquote", content: [p("Quoted")] })
    caret(e, 0, 0)
    expect(e.commands.toggleScript()).toBe(false)
  })
})

describe("setScriptElement", () => {
  it("puts an empty Parenthetical's caret inside its () and takes them off after", () => {
    const e = editor(script(line("dialogue")))
    caret(e, 0, 0)
    e.commands.setScriptElement("parenthetical")
    expect(shape(e)).toEqual([["parenthetical:()"]])
    expect(where(e)).toEqual([0, 1])
    e.view.dispatch(e.state.tr.insertText("beat"))
    e.commands.setScriptElement("dialogue")
    expect(shape(e)).toEqual([["dialogue:beat"]])
  })
})

describe("Enter", () => {
  const next: [ScriptElementType, ScriptElementType][] = [
    ["sceneHeading", "action"],
    ["action", "action"],
    ["character", "dialogue"],
    ["parenthetical", "dialogue"],
    ["dialogue", "action"],
    ["transition", "sceneHeading"],
  ]
  it.each(next)("at the end of %s starts %s", (from, to) => {
    const e = editor(script(line(from, "x")))
    caret(e, 0, -1)
    run(e, scriptEnter)
    expect(shape(e)).toEqual([[`${from}:x`, `${to}:`]])
    expect(where(e)).toEqual([1, 0])
  })

  it("just before a Parenthetical's ) moves on without splitting it", () => {
    const e = editor(script(line("parenthetical", "(beat)")))
    caret(e, 0, 5)
    run(e, scriptEnter)
    expect(shape(e)).toEqual([["parenthetical:(beat)", "dialogue:"]])
  })

  it("mid-line leaves the split to the core keymap", () => {
    const e = editor(script(line("action", "Rain falls.")))
    caret(e, 0, 4)
    expect(run(e, scriptEnter)).toBe(false)
  })

  it("on an empty line makes it Action, and on an empty Action line leaves the Script", () => {
    const e = editor(script(line("character", "MIA"), line("dialogue")))
    caret(e, 1, 0)
    run(e, scriptEnter)
    expect(shape(e)).toEqual([["character:MIA", "action:"]])
    run(e, scriptEnter)
    expect(shape(e)).toEqual([["character:MIA"], ""])
    expect(where(e)).toEqual([1, 0])
  })

  it("on an empty Action line mid-Script splits the Script around a paragraph", () => {
    const e = editor(script(line("action", "A"), line("action"), line("action", "B")))
    caret(e, 1, 0)
    run(e, scriptEnter)
    expect(shape(e)).toEqual([["action:A"], "", ["action:B"]])
    expect(where(e)).toEqual([1, 0])
  })

  it("on an empty () makes an empty Action line", () => {
    const e = editor(script(line("parenthetical", "()")))
    caret(e, 0, 1)
    run(e, scriptEnter)
    expect(shape(e)).toEqual([["action:"]])
  })
})

describe("Tab and Shift-Tab", () => {
  const tab = (element: ScriptElementType, t: string, command = scriptTab) => {
    const e = editor(script(line(element, t)))
    caret(e, 0, -1)
    run(e, command)
    return e
  }

  it("turns Action into Character", () => {
    expect(shape(tab("action", "Mia"))).toEqual([["character:Mia"]])
  })

  it("makes an empty Character a Transition, and adds a Parenthetical below a named one", () => {
    expect(shape(tab("character", ""))).toEqual([["transition:"]])
    const e = tab("character", "MIA")
    expect(shape(e)).toEqual([["character:MIA", "parenthetical:()"]])
    expect(where(e)).toEqual([1, 1])
  })

  it("makes an empty Dialogue a Parenthetical, and adds one below a spoken one", () => {
    expect(shape(tab("dialogue", ""))).toEqual([["parenthetical:()"]])
    expect(shape(tab("dialogue", "Hi."))).toEqual([["dialogue:Hi.", "parenthetical:()"]])
  })

  it("swallows Tab on other lines, and passes it on outside a Script", () => {
    expect(shape(tab("sceneHeading", "INT. HALL"))).toEqual([["sceneHeading:INT. HALL"]])
    const e = editor(p("Prose"))
    caret(e, 0, 0)
    expect(run(e, scriptTab)).toBe(false)
  })

  it("Shift-Tab steps Character, Transition and Parenthetical back", () => {
    expect(shape(tab("character", "MIA", scriptShiftTab))).toEqual([["action:MIA"]])
    expect(shape(tab("transition", "CUT TO:", scriptShiftTab))).toEqual([["character:CUT TO:"]])
    expect(shape(tab("parenthetical", "(beat)", scriptShiftTab))).toEqual([["dialogue:beat"]])
  })
})

describe("Backspace", () => {
  it("in an empty () makes Dialogue", () => {
    const e = editor(script(line("character", "MIA"), line("parenthetical", "()")))
    caret(e, 1, 1)
    run(e, scriptBackspace)
    expect(shape(e)).toEqual([["character:MIA", "dialogue:"]])
  })

  it("at the start of a Script lifts its first line out as a paragraph", () => {
    const e = editor(script(line("sceneHeading", "INT. HALL"), line("action", "Rain.")))
    caret(e, 0, 0)
    run(e, scriptBackspace)
    expect(shape(e)).toEqual(["INT. HALL", ["action:Rain."]])
    expect(where(e)).toEqual([0, 0])
  })

  it("at the start of a later line joins it to the line above", () => {
    const e = editor(script(line("character", "MIA"), line("dialogue", "Hi.")))
    caret(e, 1, 0)
    run(e, scriptBackspace)
    expect(shape(e)).toEqual([["character:MIAHi."]])
    expect(where(e)).toEqual([0, 3])
  })

  it("rejoins a split Script", () => {
    const e = editor(script(line("action", "A")), p(), script(line("action", "B")))
    caret(e, 1, 0)
    e.commands.joinBackward()
    expect(shape(e)).toEqual([["action:A", "action:B"]])
  })
})

describe("INT. and EXT.", () => {
  const type = (e: Editor, typed: string) => {
    const { from } = e.state.selection
    const textBefore = e.state.doc.textBetween(e.state.selection.$from.start(), from) + typed
    const match = (sceneHeadingRule.find as RegExp).exec(textBefore)
    if (!match) return false
    const tr = e.state.tr
    const range = { from: from - (match[0].length - typed.length), to: from }
    const result = sceneHeadingRule.handler({ state: { doc: e.state.doc, tr } as never, range, match } as never)
    if (result === null) return false
    e.view.dispatch(tr)
    return true
  }

  it("on an empty paragraph starts a Script with a Scene Heading", () => {
    const e = editor(p("Before."), p("int."))
    caret(e, 1, -1)
    expect(type(e, " ")).toBe(true)
    expect(shape(e)).toEqual(["Before.", ["sceneHeading:INT. "]])
    expect(where(e)).toEqual([1, 5])
  })

  it("does nothing after other text", () => {
    const e = editor(p("The ext."))
    caret(e, 0, -1)
    expect(type(e, " ")).toBe(false)
  })
})

describe("joining", () => {
  it("joins Scripts left adjacent by a local edit, but not by a remote one", () => {
    const e = editor(script(line("action", "A")), p("x"), script(line("action", "B")))
    const at = e.state.doc.child(0).nodeSize
    e.view.dispatch(e.state.tr.delete(at, at + 3).setMeta("y-sync$", { isChangeOrigin: true }))
    expect(shape(e)).toEqual([["action:A"], ["action:B"]])
    e.view.dispatch(e.state.tr.insertText("!", 2))
    expect(shape(e)).toEqual([["action:!A", "action:B"]])
  })
})

describe("scriptSlice", () => {
  it("makes pasted paragraphs Action lines inside a Script, and leaves them alone outside", () => {
    const e = editor(script(line("character", "MIA")), p())
    const { schema } = e
    const slice = new Slice(Fragment.from([schema.nodes.paragraph!.create(null, schema.text("One")), schema.nodes.paragraph!.create(null, schema.text("Two"))]), 1, 1)
    const inside = scriptSlice(slice, e.state.doc.resolve(2))
    expect(inside.content.childCount).toBe(2)
    inside.content.forEach((node) => expect([node.type.name, node.attrs.element]).toEqual(["scriptElement", "action"]))
    expect(scriptSlice(slice, e.state.doc.resolve(e.state.doc.content.size - 1))).toBe(slice)
  })

  it("makes each line of a pasted paragraph with line breaks an Action line", () => {
    const e = editor(script(line("character", "MIA")))
    const lines = e.schema.nodeFromJSON({ type: "paragraph", content: [text("One"), br, text("Two")] })
    const inside = scriptSlice(new Slice(Fragment.from(lines), 1, 1), e.state.doc.resolve(2))
    const out: string[] = []
    inside.content.forEach((node) => out.push(`${node.attrs.element}:${node.textContent}`))
    expect(out).toEqual(["action:One", "action:Two"])
  })
})

describe("Shift-Enter", () => {
  it("acts as Enter in a Script, adding no line break", () => {
    const e = editor(script(line("character", "MIA")))
    caret(e, 0, -1)
    run(e, scriptShiftEnter)
    expect(shape(e)).toEqual([["character:MIA", "dialogue:"]])

    caret(e, 0, 1)
    run(e, scriptShiftEnter)
    expect(shape(e)).toEqual([["character:M", "character:IA", "dialogue:"]])
  })

  it("passes outside a Script", () => {
    const e = editor(p("Rain."))
    caret(e, 0, 2)
    expect(run(e, scriptShiftEnter)).toBe(false)
  })
})

describe("scriptCues", () => {
  it("lists distinct Character cues in order, ignoring case", () => {
    const doc = {
      type: "doc",
      content: [
        p("MIA said nothing."),
        script(line("character", "MIA"), line("dialogue", "Hi."), line("character", " Jordan "), line("character", "mia")),
        script(line("action", "JORDAN")),
      ],
    }
    expect(scriptCues(doc)).toEqual(["MIA", "Jordan"])
  })
})
