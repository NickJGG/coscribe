import { describe, expect, it } from "vitest"
import { chapterSchema } from "./index"
import {
  chapterIntro,
  expandSceneHeading,
  narratedBlocks,
  narrationPoint,
  narrationPos,
  narrationUnits,
  sentences,
  unitAfter,
  unitAt,
} from "./narration"

const text = (text: string, ...marks: { type: string }[]) => ({ type: "text", text, ...(marks.length ? { marks } : {}) })
const paragraph = (...runs: object[]) => ({ type: "paragraph", content: runs })
const quote = (...paragraphs: object[]) => ({ type: "blockquote", content: paragraphs })
const line = (element: string, words: string) => ({ type: "scriptElement", attrs: { element }, content: [text(words)] })
const script = (...lines: object[]) => ({ type: "script", content: lines })
const doc = (...content: object[]) => chapterSchema.nodeFromJSON({ type: "doc", content })
const units = (...content: object[]) => narrationUnits(doc(...content))
const spoken = (...content: object[]) => units(...content).map((u) => u.speak)

describe("sentences", () => {
  const split = (s: string) => sentences(s).map(([from, to]) => s.slice(from, to))

  it("keeps a dialogue tag with its quote", () => {
    expect(split("“You could stop,” she told him. He didn’t. “Why?” she asked. “Because.”")).toEqual([
      "“You could stop,” she told him.",
      "He didn’t.",
      "“Why?” she asked.",
      "“Because.”",
    ])
  })

  it("doesn't end a sentence at a title", () => {
    expect(split("Mr. Smith left. Dr. Ames stayed.")).toEqual(["Mr. Smith left.", "Dr. Ames stayed."])
  })

  it("reads a line break as a space", () => {
    expect(split("Roses are red\nviolets are blue.")).toEqual(["Roses are red\nviolets are blue."])
  })
})

describe("narrationUnits", () => {
  it("splits paragraphs into sentences, pausing longer at the paragraph's end and ignoring marks", () => {
    const [a, b, c] = units(paragraph(text("One. "), text("Two", { type: "italic" }), text(" too.")), paragraph(text("Three.")))
    expect(a).toEqual({ block: 0, from: 0, to: 4, speak: "One.", pauseAfterMs: 0, kind: "sentence" })
    expect(b).toMatchObject({ block: 0, from: 5, to: 13, speak: "Two too.", kind: "sentence" })
    expect(b!.pauseAfterMs).toBeGreaterThan(0)
    expect(c).toMatchObject({ block: 1, from: 0, to: 6, speak: "Three." })
  })

  it("speaks a line break as a space and counts it as one character", () => {
    const [unit] = units(paragraph(text("Up"), { type: "hardBreak" }, text("down.")))
    expect(unit).toMatchObject({ from: 0, to: 8, speak: "Up down." })
  })

  it("makes a Scene Break a silent pause and skips empty paragraphs", () => {
    const all = units(paragraph(text("Before.")), { type: "sceneBreak" }, { type: "paragraph" }, paragraph(text("After.")))
    expect(all.map((u) => [u.block, u.kind, u.speak])).toEqual([
      [0, "sentence", "Before."],
      [1, "pause", ""],
      [3, "sentence", "After."],
    ])
    expect(all[1]!.pauseAfterMs).toBeGreaterThanOrEqual(1000)
  })

  it("reads a block quote's paragraphs separately, at offsets into the quote's run-together text", () => {
    expect(units(quote(paragraph(text("Dear Sam.")), paragraph(text("Come home.")))).map((u) => [u.block, u.from, u.to])).toEqual([
      [0, 0, 9],
      [0, 9, 19],
    ])
  })

  it("expands Scene Headings, speaks cues as names and skips Transitions", () => {
    const lines = script(
      line("sceneHeading", "INT. KITCHEN - NIGHT"),
      line("action", "Rain."),
      line("character", "MARA (V.O.)"),
      line("parenthetical", "(quietly)"),
      line("dialogue", "Stay."),
      line("transition", "CUT TO:")
    )
    const all = units(lines)
    expect(all.map((u) => u.speak)).toEqual(["Interior KITCHEN - NIGHT", "Rain.", "MARA", "(quietly)", "Stay."])
    expect(all[2]).toMatchObject({ kind: "cue", from: 25, to: 36 })
    expect(all[2]!.pauseAfterMs).toBeGreaterThan(0)
  })

  it("reads struck text", () => {
    expect(spoken(paragraph(text("Gone", { type: "strike" }), text(" now.")))).toEqual(["Gone now."])
  })
})

describe("expandSceneHeading", () => {
  it("spells out interior and exterior", () => {
    expect(expandSceneHeading("EXT. BEACH - DAY")).toBe("Exterior BEACH - DAY")
    expect(expandSceneHeading("INT./EXT. CAR - MOVING")).toBe("Interior/Exterior CAR - MOVING")
    expect(expandSceneHeading("INTERIOR DESIGN")).toBe("INTERIOR DESIGN")
  })
})

describe("chapterIntro", () => {
  it("announces the Chapter, with a pause after", () => {
    expect(chapterIntro(3, "The Long Night")).toMatchObject({ block: -1, speak: "Chapter 3. The Long Night.", kind: "intro" })
    expect(chapterIntro(1, "Why?").speak).toBe("Chapter 1. Why?")
    expect(chapterIntro(2, " ").speak).toBe("Chapter 2.")
    expect(chapterIntro(1, "x").pauseAfterMs).toBeGreaterThan(0)
  })
})

describe("unitAt", () => {
  const all = units(paragraph(text("One. Two.")), { type: "sceneBreak" }, paragraph(text("Three.")))

  it("finds the unit a point is in, or the next one", () => {
    expect(unitAt(all, 0, 0)).toBe(0)
    expect(unitAt(all, 0, 6)).toBe(1)
    expect(unitAt(all, 0, 4)).toBe(1)
    expect(unitAt(all, 0, 9)).toBe(2)
    expect(unitAt(all, 2)).toBe(3)
    expect(unitAt(all, 3)).toBe(-1)
  })

  it("counts the blocks read from", () => {
    expect(narratedBlocks(all)).toEqual([0, 2])
  })
})

describe("unitAfter", () => {
  const all = units(paragraph(text("One. Two.")), { type: "sceneBreak" }, paragraph(text("Three.")))

  it("passes over a unit the point is inside, and a pause it's at", () => {
    expect(unitAfter(all, 0, 4)).toBe(1)
    expect(unitAfter(all, 0, 2)).toBe(1)
    expect(unitAfter(all, 0, 9)).toBe(2)
    expect(unitAfter(all, 1, 0)).toBe(3)
    expect(unitAfter(all, 2, 6)).toBe(-1)
  })
})

describe("narrationPos and narrationPoint", () => {
  const d = doc(
    paragraph(text("Up"), { type: "hardBreak" }, text("down.")),
    quote(paragraph(text("Dear Sam.")), paragraph(text("Come home."))),
    { type: "sceneBreak" },
    paragraph(text("End."))
  )
  const at = (pos: number, length: number) => d.textBetween(pos, pos + length)

  it("finds a point's text, past line breaks and into a quote's paragraphs", () => {
    expect(at(narrationPos(d, 0, 3), 4)).toBe("down")
    expect(at(narrationPos(d, 1, 5), 3)).toBe("Sam")
    expect(at(narrationPos(d, 1, 9), 4)).toBe("Come")
    expect(at(narrationPos(d, 3, 0), 4)).toBe("End.")
  })

  it("biases a seam between a quote's paragraphs either way", () => {
    expect(d.resolve(narrationPos(d, 1, 9, -1)).parent.textContent).toBe("Dear Sam.")
    expect(d.resolve(narrationPos(d, 1, 9, 1)).parent.textContent).toBe("Come home.")
    expect(d.resolve(narrationPos(d, 1, 19)).parent.textContent).toBe("Come home.")
  })

  it("round-trips", () => {
    for (const [block, offset] of [[0, 0], [0, 3], [0, 8], [1, 5], [1, 12], [2, 0], [3, 2]] as const) {
      expect(narrationPoint(d, narrationPos(d, block, offset))).toEqual({ block, offset })
    }
  })
})
