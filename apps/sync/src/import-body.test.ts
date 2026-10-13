import { describe, expect, it } from "vitest"
import * as Y from "yjs"
import { addedFields, fieldFragment, outlineCharacters } from "@coscribe/editor"
import { parseImportBody, writeOutline } from "./import-body"

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })

const body = {
  userId: "u1",
  chapters: [
    {
      title: " Arrival ",
      content: doc("It rained."),
      outline: {
        fields: [
          { label: "summary", content: doc("Mia arrives.") },
          { label: "Weather", content: doc("Rain throughout.") },
        ],
        characters: ["Mia", "Nobody"],
      },
    },
  ],
  entries: [{ type: "character", name: "Mia", description: "", aliases: ["M"], body: doc("A courier.") }],
}

describe("parseImportBody", () => {
  it("parses every document and trims names", () => {
    const parsed = parseImportBody(body)!
    expect(parsed.chapters[0]!.title).toBe("Arrival")
    expect(parsed.chapters[0]!.content.textContent).toBe("It rained.")
    expect(parsed.entries[0]!.aliases).toEqual(["M"])
  })

  it("refuses what the schemas or tables wouldn't take", () => {
    expect(parseImportBody(null)).toBeNull()
    expect(parseImportBody({ ...body, chapters: [] })).toBeNull()
    expect(parseImportBody({ ...body, chapters: [{ title: "", content: doc("x") }] })).toBeNull()
    expect(parseImportBody({ ...body, chapters: [{ title: "A", content: { type: "doc", content: [{ type: "nope" }] } }] })).toBeNull()
    expect(parseImportBody({ ...body, entries: [{ ...body.entries[0], type: "monster" }] })).toBeNull()
    expect(parseImportBody({ ...body, entries: [{ ...body.entries[0], aliases: Array(21).fill("a") }] })).toBeNull()
  })
})

describe("writeOutline", () => {
  it("fills default fields by label, adds the rest, and links Characters by name", () => {
    const outline = parseImportBody(body)!.chapters[0]!.outline!
    const ydoc = new Y.Doc()
    writeOutline(ydoc, outline, new Map([["mia", "entry-mia"]]))

    expect(ydoc.getXmlFragment(fieldFragment("summary")).toString()).toContain("Mia arrives.")
    const [added] = addedFields(ydoc)
    expect(added!.label).toBe("Weather")
    expect(ydoc.getXmlFragment(fieldFragment(added!.id)).toString()).toContain("Rain throughout.")
    expect(outlineCharacters(ydoc)).toEqual(["entry-mia"])
  })
})
