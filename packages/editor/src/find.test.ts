import { getSchema, type JSONContent } from "@tiptap/core"
import type { Node } from "@tiptap/pm/model"
import { describe, expect, it } from "vitest"
import { findText, MIN_QUERY } from "./find"
import { chapterExtensions, entryExtensions } from "./index"
import { blockTexts } from "./entry-mentions"

function found(text: string, query: string) {
  return findText(text, query).map((m) => text.slice(m.from, m.to))
}

describe("findText", () => {
  it("ignores case", () => {
    expect(found("The tide. THE TIDE. the Tide.", "the tide")).toEqual(["The tide", "THE TIDE", "the Tide"])
  })

  it("ignores accents either way round", () => {
    expect(found("A café by the Cafe", "cafe")).toEqual(["café", "Cafe"])
    expect(found("A café by the Cafe", "café")).toEqual(["café", "Cafe"])
  })

  it("includes a decomposed accent in the match", () => {
    const text = "café au lait"
    expect(findText(text, "cafe")).toEqual([{ from: 0, to: 5 }])
  })

  it("treats curly and straight quotes alike", () => {
    expect(found("don’t and don't", "don't")).toEqual(["don’t", "don't"])
    expect(found("“Run,” she said", '"run,"')).toEqual(["“Run,”"])
  })

  it("treats an ellipsis as three dots and an em dash as two hyphens", () => {
    expect(found("Wait… no, wait...", "wait...")).toEqual(["Wait…", "wait..."])
    expect(found("so— so--", "so--")).toEqual(["so—", "so--"])
    expect(found("Wait… no", "…")).toEqual(["…"])
  })

  it("returns UTF-16 offsets into the original text after emoji and other multi-unit characters", () => {
    const text = "🌊 waves 𝒜 then waves"
    const matches = findText(text, "waves")
    expect(matches.map((m) => text.slice(m.from, m.to))).toEqual(["waves", "waves"])
    expect(matches[0]).toEqual({ from: 3, to: 8 })
  })

  it("keeps offsets right when lowercasing changes length", () => {
    const text = "İstanbul and istanbul"
    expect(found(text, "istanbul")).toEqual(["İstanbul", "istanbul"])
  })

  it("doesn't overlap matches", () => {
    expect(findText("aaaa", "aa")).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ])
  })

  it(`needs at least ${MIN_QUERY} characters`, () => {
    expect(findText("a cat", "a")).toEqual([])
    expect(findText("a cat", "  ")).toEqual([])
    expect(findText("a cat", "ca")).toEqual([{ from: 2, to: 4 }])
  })
})

/** The editor's view: each textblock's `textContent`, as the Find plugin will search them. */
function editorBlocks(doc: Node): string[] {
  const texts: string[] = []
  doc.descendants((node) => {
    if (!node.isTextblock) return true
    texts.push(node.textContent)
    return false
  })
  return texts
}

describe("blockTexts and the editor agree", () => {
  const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content })
  const text = (t: string, marks: JSONContent["marks"] = []): JSONContent => ({ type: "text", text: t, marks })
  const item = (t: string): JSONContent => ({ type: "listItem", content: [p(text(t))] })

  const docs: [string, ReturnType<typeof getSchema>, JSONContent][] = [
    [
      "chapter",
      getSchema(chapterExtensions),
      {
        type: "doc",
        content: [
          p(text("The tide ", [{ type: "author", attrs: { userId: "a" } }]), text("came", [{ type: "italic" }]), text(" in.")),
          { type: "paragraph" },
          { type: "sceneBreak" },
          p(text("Then the "), text("tide", [{ type: "note", attrs: { id: "n" } }]), text(" went out.")),
          {
            type: "script",
            content: [
              { type: "scriptElement", attrs: { element: "character" }, content: [text("TIDE")] },
              { type: "scriptElement", attrs: { element: "dialogue" } },
              { type: "scriptElement", attrs: { element: "dialogue" }, content: [text("The "), text("tide", [{ type: "bold" }])] },
            ],
          },
        ],
      },
    ],
    [
      "entry",
      getSchema(entryExtensions),
      {
        type: "doc",
        content: [
          p(text("Known for the tide:")),
          { type: "bulletList", content: [item("tide tables"), item("lying")] },
          { type: "sceneBreak" },
          { type: "orderedList", content: [item("ebb tide")] },
        ],
      },
    ],
  ]

  it.each(docs)("in a %s, with the same match numbering", (_kind, schema, json) => {
    const doc = schema.nodeFromJSON(json)
    const server = blockTexts(doc.toJSON())
    const editor = editorBlocks(doc).filter(Boolean)
    expect(server).toEqual(editor)

    const occurrences = (blocks: string[]) => blocks.flatMap((b, i) => findText(b, "tide").map((m) => [i, m.from]))
    expect(occurrences(server)).toEqual(occurrences(editor))
    expect(occurrences(server).length).toBeGreaterThan(1)
  })
})
