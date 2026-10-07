import { describe, expect, it } from "vitest"
import { blockTexts, countMentions, findMentions, type MentionTarget } from "./mentions"

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

  it("skips Entries that don't link their Mentions", () => {
    expect(found("Wren and Aldous", [entry("wren", "Wren", [], false), keeper])).toEqual([["keeper", "Aldous"]])
  })

  it("treats names as literal text", () => {
    expect(found("Dr. Who? and Dra Who", [entry("dr", "Dr. Who?")])).toEqual([["dr", "Dr. Who?"]])
  })

  it("ignores blank Aliases", () => {
    expect(found("a b", [entry("x", "Nobody", ["", "  "])])).toEqual([])
  })

  it("reports UTF-16 offsets", () => {
    const text = "😀 Wren"
    expect(findMentions(text, ENTRIES)).toEqual([{ entryId: "wren", from: 3, to: 7 }])
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
})
