import { describe, expect, it } from "vitest"
import { chapterSchema } from "./index"
import {
  chapterIntro,
  expandSceneHeading,
  narratedBlocks,
  narrationPoint,
  narrationPos,
  narrationUnits,
  quoteSpans,
  sentences,
  speakerKey,
  unitAfter,
  unitAt,
  type NarrationUnit,
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

const cast = [
  { id: "mara", name: "Mara", aliases: [], linkEntryMentions: true },
  { id: "aldous", name: "Aldous", aliases: ["Keeper Aldous"], linkEntryMentions: true },
  { id: "wren", name: "Wren", aliases: [], linkEntryMentions: false },
]
const castUnits = (...content: object[]) => narrationUnits(doc(...content), cast)
const who = (u: NarrationUnit) => (u.speaker ? ("entryId" in u.speaker ? u.speaker.entryId : `cue ${u.speaker.cue}`) : "narrator")
/** Who reads each quote's opening, one entry per quote. */
const readers = (...paragraphs: string[]) =>
  castUnits(...paragraphs.map((p) => paragraph(text(p))))
    .filter((u) => /^[“"]/.test(u.speak))
    .map(who)

describe("quoteSpans", () => {
  it("finds straight and curly quotes, running an unclosed one to the end", () => {
    expect(quoteSpans('“Hi,” she said. "Bye." “And')).toEqual([
      { from: 0, to: 5, unclosed: false },
      { from: 16, to: 22, unclosed: false },
      { from: 23, to: 27, unclosed: true },
    ])
  })
})

describe("narrationUnits with Characters", () => {
  it("reads a back-and-forth by tag, beat, then turns, with a pronoun tag taking a turn", () => {
    expect(
      readers(
        "“You could stop,” Mara said.",
        "Aldous set the lamp down. “Not tonight.”",
        "“Why not?”",
        "“Because the ships would know.”",
        "“You could stop,” she told him."
      )
    ).toEqual(["mara", "aldous", "mara", "aldous", "mara"])
  })

  it("keeps a speech that runs on past an unclosed quote with its speaker, without taking a turn", () => {
    expect(
      readers(
        "“Light it,” Mara said.",
        "Aldous turned from the glass. “Not tonight.”",
        "“Why not?”",
        "“When I was a boy, the strait was full of ships. Every night my father lit this lamp, and every night they came home by it.",
        "“So I light it. Somebody has to.”",
        "“Even if nobody comes?”"
      )
    ).toEqual(["mara", "aldous", "mara", "aldous", "aldous", "mara"])
  })

  it("reads every sentence of a quote in its speaker's voice", () => {
    const all = castUnits(paragraph(text("Aldous turned. “Not tonight. Not ever.”")))
    expect(all.map((u) => [u.speak, who(u)])).toEqual([
      ["Aldous turned.", "narrator"],
      ["“Not tonight.", "aldous"],
      ["Not ever.”", "aldous"],
    ])
  })

  it("stops guessing once a third Character is named", () => {
    expect(
      readers(
        "“Ready?” Mara asked.",
        "Aldous nodded. “Ready.”",
        "Wren came up the stairs with the oil. “Not without this.”",
        "“Then light it.”",
        "“You do it,” Mara said, and handed Wren the match."
      )
    ).toEqual(["mara", "aldous", "wren", "narrator", "mara"])
  })

  it("lets a tag put a wrong guess right and reset the turns", () => {
    expect(
      readers(
        "Aldous shook the rain off his coat. “Evening.”",
        "“You’re late,” Mara said.",
        "“The ferry was slow.”",
        "“It’s always slow.”",
        "“And you never once complain about it.”",
        "“I’m complaining now,” Aldous said.",
        "“Good.”"
      )
    ).toEqual(["aldous", "mara", "aldous", "mara", "aldous", "aldous", "mara"])
  })

  it("carries the turns over a paragraph of narration", () => {
    expect(
      readers(
        "“Light it,” Mara said.",
        "Aldous shook his head. “No.”",
        "For a long while neither of them spoke. The wind worked at the gallery door, and the oil can ticked as it cooled.",
        "“Please.”",
        "“Fine.”"
      )
    ).toEqual(["mara", "aldous", "mara", "aldous"])
  })

  it("starts the turns over after a Scene Break", () => {
    expect(readers("“Go,” Mara said.", "Aldous sat. “No.”")).toEqual(["mara", "aldous"])
    const all = castUnits(
      paragraph(text("“Go,” Mara said.")),
      paragraph(text("Aldous sat. “No.”")),
      { type: "sceneBreak" },
      paragraph(text("“Well?”"))
    )
    expect(who(all.at(-1)!)).toBe("narrator")
  })

  it("cuts a sentence at its quote's edges, keeping the closing punctuation with the quote", () => {
    const all = castUnits(paragraph(text("“You could stop,” Mara told him once. “Nobody would know.”")), paragraph(text("End.")))
    expect(all.slice(0, 3).map((u) => [u.from, u.to, u.speak, who(u), u.pauseAfterMs])).toEqual([
      [0, 17, "“You could stop,”", "mara", 0],
      [18, 37, "Mara told him once.", "narrator", 0],
      [38, 58, "“Nobody would know.”", "mara", 250],
    ])
  })

  it("finds a tag before the quote, and after a question that ends its sentence", () => {
    expect(readers("Mara whispered, “Now.”", "“Now?” asked Keeper Aldous.")).toEqual(["mara", "aldous"])
  })

  it("leaves a paragraph whole when there are no Characters", () => {
    const content = [paragraph(text("“You could stop,” Mara told him once."))]
    expect(units(...content)).toEqual(narrationUnits(doc(...content), []))
    expect(units(...content)).toHaveLength(1)
  })

  it("leaves a quote no one can be found for whole, with the narrator", () => {
    expect(castUnits(paragraph(text("“Hello,” someone said."))).map((u) => [u.speak, who(u)])).toEqual([
      ["“Hello,” someone said.", "narrator"],
    ])
  })

  it("ignores names inside quotes", () => {
    expect(readers("“Mara said you’d come,” he said.", "“Aldous?”")).toEqual(["narrator", "narrator"])
  })

  it("gives Dialogue its cue's speaker, an Entry or the cue itself, and leaves the rest with the narrator", () => {
    const all = castUnits(
      script(
        line("character", "keeper aldous (CONT'D)"),
        line("parenthetical", "(quietly)"),
        line("dialogue", "Stay."),
        line("action", "Rain."),
        line("dialogue", "Hm."),
        line("character", "OLD   MAN"),
        line("dialogue", "Go.")
      )
    )
    expect(all.map((u) => [u.kind, u.speak, who(u)])).toEqual([
      ["cue", "keeper aldous", "aldous"],
      ["sentence", "(quietly)", "narrator"],
      ["sentence", "Stay.", "aldous"],
      ["sentence", "Rain.", "narrator"],
      ["sentence", "Hm.", "narrator"],
      ["cue", "OLD   MAN", "cue OLD MAN"],
      ["sentence", "Go.", "cue OLD MAN"],
    ])
  })
})

describe("speakerKey", () => {
  it("keys Entries and cues apart", () => {
    expect(speakerKey({ entryId: "a1" })).toBe("entry:a1")
    expect(speakerKey({ cue: "OLD MAN" })).toBe("cue:OLD MAN")
  })
})
