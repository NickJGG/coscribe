import { getSchema } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { chapterExtensions, countWords, documentName, entryExtensions, parseDocumentName } from "./index"

describe("chapter schema", () => {
  const schema = getSchema(chapterExtensions)

  it("allows only paragraphs, line breaks, block quotes, Scene Breaks, Scripts, bold, italic, strikethrough, authorship, and Notes", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([
      "blockquote",
      "doc",
      "hardBreak",
      "paragraph",
      "sceneBreak",
      "script",
      "scriptElement",
      "text",
    ])
    expect(Object.keys(schema.marks).sort()).toEqual(["author", "bold", "italic", "note", "strike"])
    expect(Object.keys(schema.nodes.paragraph!.spec.attrs ?? {})).toEqual(["textAlign"])
  })

  it("keeps Scene Breaks out of block quotes", () => {
    expect(() =>
      schema.nodeFromJSON({ type: "doc", content: [{ type: "blockquote", content: [{ type: "sceneBreak" }] }] }).check()
    ).toThrow()
  })

  it("accepts a Script of marked lines between paragraphs", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before" }] },
        {
          type: "script",
          content: [
            { type: "scriptElement", attrs: { element: "character" }, content: [{ type: "text", text: "MIA" }] },
            { type: "scriptElement", attrs: { element: "dialogue" }, content: [{ type: "text", text: "Hi.", marks: [{ type: "bold" }] }] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    })
    expect(() => doc.check()).not.toThrow()
    expect(countWords(doc)).toBe(4)
  })

  it("accepts a Chapter with a Scene Break between paragraphs", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Before", marks: [{ type: "italic" }] }] },
        { type: "sceneBreak" },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    })
    expect(() => doc.check()).not.toThrow()
  })
})

describe("entry schema", () => {
  const schema = getSchema(entryExtensions)

  it("adds bulleted and numbered lists to the Chapter schema", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([
      "blockquote",
      "bulletList",
      "doc",
      "hardBreak",
      "listItem",
      "orderedList",
      "paragraph",
      "sceneBreak",
      "text",
    ])
    expect(Object.keys(schema.marks).sort()).toEqual(["author", "bold", "italic", "note", "strike"])
  })

  it("accepts an Entry body with a list", () => {
    const item = (text: string) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Known for:" }] },
        { type: "bulletList", content: [item("A limp"), item("Lying")] },
      ],
    })
    expect(() => doc.check()).not.toThrow()
  })

  it("lets a block quote hold a list", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "bulletList",
              content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] }],
            },
          ],
        },
      ],
    })
    expect(() => doc.check()).not.toThrow()
  })
})

describe("document names", () => {
  const id = "0b7e3c1a-4f7d-4c55-9a2e-1d2f3a4b5c6d"

  it("round-trips Chapter and Entry names", () => {
    expect(parseDocumentName(documentName("chapter", id))).toEqual({ kind: "chapter", id })
    expect(parseDocumentName(documentName("entry", id))).toEqual({ kind: "entry", id })
  })

  it("rejects unknown kinds and malformed ids", () => {
    expect(parseDocumentName(`snapshot:${id}`)).toBeNull()
    expect(parseDocumentName("chapter:nope")).toBeNull()
    expect(parseDocumentName(`entry:${id}:extra`)).toBeNull()
  })
})

describe("countWords", () => {
  const schema = getSchema(chapterExtensions)

  it("counts across paragraphs and Scene Breaks without joining words", () => {
    const doc = schema.nodeFromJSON({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "The bells began" }] },
        { type: "sceneBreak" },
        { type: "paragraph", content: [{ type: "text", text: "at low water." }] },
      ],
    })
    expect(countWords(doc)).toBe(6)
  })

  it("is zero for an empty Chapter", () => {
    expect(countWords(schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph" }] }))).toBe(0)
  })
})
