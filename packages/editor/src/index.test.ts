import { getSchema } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { chapterDocumentName, chapterExtensions, parseDocumentName } from "./index"

describe("chapter schema", () => {
  const schema = getSchema(chapterExtensions)

  it("allows only paragraphs, Scene Breaks, bold, and italic", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual(["doc", "paragraph", "sceneBreak", "text"])
    expect(Object.keys(schema.marks).sort()).toEqual(["bold", "italic"])
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

describe("document names", () => {
  const id = "0b7e3c1a-4f7d-4c55-9a2e-1d2f3a4b5c6d"

  it("round-trips a Chapter name", () => {
    expect(parseDocumentName(chapterDocumentName(id))).toEqual({ kind: "chapter", id })
  })

  it("rejects unknown kinds and malformed ids", () => {
    expect(parseDocumentName(`entry:${id}`)).toBeNull()
    expect(parseDocumentName("chapter:nope")).toBeNull()
    expect(parseDocumentName(`chapter:${id}:extra`)).toBeNull()
  })
})
