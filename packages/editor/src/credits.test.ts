import { describe, expect, it } from "vitest"
import { countAuthorCharacters } from "./credits"

const by = (userId: string) => [{ type: "author", attrs: { userId, at: 1 } }]

describe("countAuthorCharacters", () => {
  it("sums text per author across paragraphs, lists, and other marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Mia wrote ", marks: by("mia") },
            { type: "text", text: "this", marks: [{ type: "bold" }, ...by("jordan")] },
          ],
        },
        { type: "sceneBreak" },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "more", marks: by("mia") }] }] }],
        },
      ],
    }
    expect(Object.fromEntries(countAuthorCharacters(doc))).toEqual({ mia: 14, jordan: 4 })
  })

  it("adds into an existing tally and skips unmarked text", () => {
    const tally = new Map([["mia", 5]])
    countAuthorCharacters({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "anon" }] }] }, tally)
    countAuthorCharacters({ type: "text", text: "é😀", marks: by("mia") }, tally)
    expect(Object.fromEntries(tally)).toEqual({ mia: 7 })
  })

  it("handles an empty document", () => {
    expect(countAuthorCharacters({ type: "doc" }).size).toBe(0)
  })
})
