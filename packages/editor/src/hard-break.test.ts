import { Editor, type JSONContent } from "@tiptap/core"
import { Slice } from "@tiptap/pm/model"
import { TextSelection } from "@tiptap/pm/state"
import { describe, expect, it } from "vitest"
import { lineBreakSlice } from "./hard-break"
import { chapterExtensions, chapterSchema, countWords, entrySchema, outlineSchema, SCHEMA_VERSION } from "./index"

const text = (t: string): JSONContent => ({ type: "text", text: t })
const br: JSONContent = { type: "hardBreak" }
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content })

describe("line breaks", () => {
  it("are in Chapters and Entries but not Outlines, at schema version 5", () => {
    expect(chapterSchema.nodes.hardBreak).toBeDefined()
    expect(entrySchema.nodes.hardBreak).toBeDefined()
    expect(outlineSchema.nodes.hardBreak).toBeUndefined()
    expect(SCHEMA_VERSION).toBe(5)
  })

  it("read as one \\n, so text offsets are ProseMirror offsets", () => {
    const paragraph = chapterSchema.nodeFromJSON(p(text("Roses"), br, text("are red")))
    expect(paragraph.textContent).toBe("Roses\nare red")
    expect(paragraph.textContent.length).toBe(paragraph.content.size)
  })

  it("keep words apart in the word count", () => {
    const doc = chapterSchema.nodeFromJSON({ type: "doc", content: [p(text("Roses"), br, text("red"))] })
    expect(countWords(doc)).toBe(2)
  })

  it("aren't allowed in a Script line", () => {
    const doc = { type: "doc", content: [{ type: "script", content: [{ type: "scriptElement", content: [text("a"), br] }] }] }
    expect(() => chapterSchema.nodeFromJSON(doc).check()).toThrow()
  })

  it("setHardBreak adds one in a paragraph", () => {
    const e = new Editor({ element: null, extensions: chapterExtensions, content: { type: "doc", content: [p(text("Roses"))] } })
    e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, 6)))
    e.commands.setHardBreak()
    e.view.dispatch(e.state.tr.insertText("red"))
    expect(e.state.doc.firstChild!.textContent).toBe("Roses\nred")
  })
})

describe("lineBreakSlice", () => {
  const paste = (...content: JSONContent[]) => {
    const slice = new Slice(chapterSchema.nodeFromJSON({ type: "doc", content }).content, 1, 1)
    const shape: string[] = []
    lineBreakSlice(slice).content.forEach((node) => shape.push(node.textContent))
    return shape
  }

  it("keeps a single <br> as a line break", () => {
    expect(paste(p(text("Roses"), br, text("are red")))).toEqual(["Roses\nare red"])
  })

  it("starts a new paragraph at 2 or more <br>", () => {
    expect(paste(p(text("Roses"), br, br, text("Violets"), br, br, br, text("Sugar")))).toEqual(["Roses", "Violets", "Sugar"])
  })

  it("drops line breaks at a paragraph's edges", () => {
    expect(paste(p(br, text("Roses"), br, text("red"), br))).toEqual(["Roses\nred"])
  })

  it("splits paragraphs inside a block quote", () => {
    const doc = chapterSchema.nodeFromJSON({ type: "doc", content: [{ type: "blockquote", content: [p(text("a"), br, br, text("b"))] }] })
    expect(lineBreakSlice(new Slice(doc.content, 0, 0)).content.firstChild!.childCount).toBe(2)
  })

  it("leaves a slice without line breaks alone", () => {
    const slice = new Slice(chapterSchema.nodeFromJSON({ type: "doc", content: [p(text("x"))] }).content, 0, 0)
    expect(lineBreakSlice(slice).content.eq(slice.content)).toBe(true)
  })
})
