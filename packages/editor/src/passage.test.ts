import { describe, expect, it } from "vitest"
import { featureError, sliceChapter } from "./passage"

const text = (text: string, userId: string, ...marks: { type: string }[]) => ({
  type: "text",
  text,
  marks: [...marks, { type: "author", attrs: { userId, at: 1 } }],
})
const paragraph = (...runs: ReturnType<typeof text>[]) => ({ type: "paragraph", content: runs })
const doc = (...content: object[]) => ({ type: "doc", content })
const quote = (...paragraphs: object[]) => ({ type: "blockquote", content: paragraphs })

const chapter = doc(
  paragraph(text("Once upon ", "mia"), text("a time", "jordan", { type: "italic" })),
  { type: "sceneBreak" },
  paragraph(text("The end.", "mia"))
)

describe("sliceChapter", () => {
  it("cuts within one paragraph across runs, keeping their marks", () => {
    expect(sliceChapter(chapter, { block: 0, offset: 5 }, { block: 0, offset: 12 })).toEqual(
      doc(paragraph(text("upon ", "mia"), text("a ", "jordan", { type: "italic" })))
    )
  })

  it("keeps paragraph breaks and Scene Breaks between the points, in either order", () => {
    const slice = doc(paragraph(text("time", "jordan", { type: "italic" })), { type: "sceneBreak" }, paragraph(text("The", "mia")))
    expect(sliceChapter(chapter, { block: 0, offset: 12 }, { block: 2, offset: 3 })).toEqual(slice)
    expect(sliceChapter(chapter, { block: 2, offset: 3 }, { block: 0, offset: 12 })).toEqual(slice)
  })

  it("drops blocks left with no text at either end", () => {
    expect(sliceChapter(chapter, { block: 0, offset: 16 }, { block: 2, offset: 0 })).toEqual(doc())
    expect(sliceChapter(chapter, { block: 1, offset: 0 }, { block: 2, offset: 4 })).toEqual(doc(paragraph(text("The ", "mia"))))
  })

  it("slices from inside a block quote to after it, keeping the quote around its paragraphs", () => {
    const letter = doc(
      quote(paragraph(text("Dear Ann,", "mia")), paragraph(text("Come home.", "mia", { type: "strike" }))),
      paragraph(text("She burned it.", "jordan"))
    )
    expect(sliceChapter(letter, { block: 0, offset: 14 }, { block: 1, offset: 3 })).toEqual(
      doc(quote(paragraph(text("home.", "mia", { type: "strike" }))), paragraph(text("She", "jordan")))
    )
    expect(sliceChapter(letter, { block: 0, offset: 5 }, { block: 0, offset: 9 })).toEqual(
      doc(quote(paragraph(text("Ann,", "mia"))))
    )
  })
})

describe("featureError", () => {
  it.each([
    ["your own words", doc(paragraph(text("Once", "mia"))), null],
    ["some of your own words", doc(paragraph(text("Once", "mia"), text(" upon", "jordan"))), null],
    ["only a co-writer's words", doc(paragraph(text("a time", "jordan"))), "Select some of your own writing to feature it."],
    ["nothing", doc(), "Select some of your own writing to feature it."],
    ["500 characters", doc(paragraph(text("é".repeat(500), "mia"))), null],
    ["501 characters", doc(paragraph(text("x".repeat(250), "mia")), paragraph(text("😀".repeat(251), "mia"))), "Too long to feature. Keep it under 500 characters."],
  ])("%s", (_, slice, error) => {
    expect(featureError(slice, "mia")).toBe(error)
  })
})
