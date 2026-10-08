import { describe, expect, it } from "vitest"
import { blockTexts, countMentions, entryNameAt, entryNamed, findMentions, type MentionTarget } from "./mentions"

const entry = (id: string, name: string, aliases: string[] = [], linkMentions = true): MentionTarget => ({
  id,
  name,
  aliases,
  linkMentions,
})

const keeper = entry("keeper", "Keeper Aldous", ["Aldous", "the old keeper"])
const wren = entry("wren", "Wren")
const point = entry("point", "Gull Point")
const light = entry("light", "Gull Point Light")
const bells = entry("bells", "The Tide Bells")
const ENTRIES = [keeper, wren, point, light, bells]

function found(text: string, entries = ENTRIES) {
  return findMentions(text, entries).map((m) => [m.entryId, text.slice(m.from, m.to)])
}

describe("findMentions", () => {
  it("finds names and Aliases, ignoring case", () => {
    expect(found("Aldous climbed. keeper aldous rested. THE OLD KEEPER slept.")).toEqual([
      ["keeper", "Aldous"],
      ["keeper", "keeper aldous"],
      ["keeper", "THE OLD KEEPER"],
    ])
  })

  it("matches before a possessive, with either apostrophe", () => {
    expect(found("Wren's lamp and Wren’s coat")).toEqual([
      ["wren", "Wren"],
      ["wren", "Wren"],
    ])
  })

  it("prefers the longest of overlapping matches", () => {
    expect(found("Out past Gull Point Light, then back to Gull Point.")).toEqual([
      ["light", "Gull Point Light"],
      ["point", "Gull Point"],
    ])
  })

  it("matches a phrase mid-sentence and across line-wrapping whitespace", () => {
    expect(found("She heard the tide bells, then the tide  bells again.")).toEqual([
      ["bells", "the tide bells"],
      ["bells", "the tide  bells"],
    ])
  })

  it("never matches inside a longer word", () => {
    expect(found("Wrenfield and Aldousson and Gull Pointe")).toEqual([])
    expect(found("Éwren and wrené")).toEqual([])
  })

  it("marks Mentions of Entries that don't link them", () => {
    const unlinked = [entry("wren", "Wren", [], false), keeper]
    expect(findMentions("Wren and Aldous", unlinked).map((m) => [m.entryId, m.linked])).toEqual([
      ["wren", false],
      ["keeper", true],
    ])
  })

  it("lets a longer unlinked match win over a shorter linked one", () => {
    expect(found("Gull Point Light", [point, entry("light", "Gull Point Light", [], false)])).toEqual([
      ["light", "Gull Point Light"],
    ])
  })

  it("treats names as literal text", () => {
    expect(found("Dr. Who? and Dra Who", [entry("dr", "Dr. Who?")])).toEqual([["dr", "Dr. Who?"]])
  })

  it("ignores blank Aliases", () => {
    expect(found("a b", [entry("x", "Nobody", ["", "  "])])).toEqual([])
  })

  it("reports UTF-16 offsets", () => {
    const text = "😀 Wren"
    expect(findMentions(text, ENTRIES)).toEqual([{ entryId: "wren", from: 3, to: 7, linked: true }])
  })
})

describe("countMentions", () => {
  it("counts per Entry, never across paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Wren met " }, { type: "text", text: "Aldous", marks: [] }] },
        { type: "sceneBreak" },
        { type: "paragraph", content: [{ type: "text", text: "Gull" }] },
        { type: "paragraph", content: [{ type: "text", text: "Point. Wren's turn." }] },
        { type: "paragraph" },
      ],
    }
    expect(blockTexts(doc)).toEqual(["Wren met Aldous", "Gull", "Point. Wren's turn."])
    expect(Object.fromEntries(countMentions(doc, ENTRIES))).toEqual({ wren: 2, keeper: 1 })
  })

  it("skips Entries that don't link their Mentions", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Wren met Aldous" }] }] }
    expect(Object.fromEntries(countMentions(doc, [entry("wren", "Wren", [], false), keeper]))).toEqual({ keeper: 1 })
  })
})

describe("entryNameAt", () => {
  const at = (text: string, selected: string, max = 80) => {
    const from = text.indexOf(selected)
    return entryNameAt(text, from, from + selected.length, max)
  }

  it("snaps a partial selection out to whole words", () => {
    expect(at("Then Wren left.", "re")).toBe("Wren")
    expect(at("Gull Point Light", "ll Poi")).toBe("Gull Point")
  })

  it("drops edge punctuation and a possessive", () => {
    expect(at("by Wren's, boat", "Wren's,")).toBe("Wren")
    expect(at("by Wren’s boat", "Wren’s")).toBe("Wren")
    expect(at("“Keeper Aldous!”", "“Keeper Aldous!”")).toBe("Keeper Aldous")
  })

  it("trims and collapses whitespace", () => {
    expect(at("at   Gull  Point  now", "  Gull  Point ")).toBe("Gull Point")
  })

  it("refuses selections without a letter or past the limit", () => {
    expect(at("Wait... 1984", "... 1984")).toBeNull()
    expect(at("The Tide Bells", "The Tide Bells", 8)).toBeNull()
  })
})

describe("entryNamed", () => {
  it("matches a name or Alias, ignoring case and spacing", () => {
    expect(entryNamed("wren", ENTRIES)).toBe(wren)
    expect(entryNamed("The  Old Keeper", ENTRIES)).toBe(keeper)
  })

  it("doesn't match part of a longer name", () => {
    expect(entryNamed("Gull Point", [light])).toBeUndefined()
    expect(entryNamed("Gull", ENTRIES)).toBeUndefined()
  })
})
