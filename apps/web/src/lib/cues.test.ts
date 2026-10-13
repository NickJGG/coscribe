import { describe, expect, it } from "vitest";
import { cueMatches, cueOptions, CUES_SHOWN } from "./cues";

const characters = [
  { name: "Wren", aliases: [] },
  { name: "Keeper Aldous", aliases: ["Al", "The Keeper"] },
];

describe("cueMatches", () => {
  it("matches the start of any word, ignoring case", () => {
    expect(cueMatches("Keeper Aldous", "al")).toBe(true);
    expect(cueMatches("Keeper Aldous", "KEE")).toBe(true);
    expect(cueMatches("MARY-ANNE", "anne")).toBe(true);
  });

  it("doesn't match inside a word", () => {
    expect(cueMatches("Keeper Aldous", "ldo")).toBe(false);
  });
});

describe("cueOptions", () => {
  it("offers names and Aliases, saying whose Alias", () => {
    expect(cueOptions("Al", characters, [])).toEqual([
      { cue: "Keeper Aldous", note: null },
      { cue: "Al", note: "Alias of Keeper Aldous" },
    ]);
  });

  it("puts used cues after Entries, skipping ones that are an Entry's name or Alias", () => {
    const used = [
      { cue: "WREN", chapter: null },
      { cue: "WAITER", chapter: null },
      { cue: "the keeper", chapter: "One" },
      { cue: "Waiter", chapter: "Two" },
      { cue: "WATCHMAN", chapter: "Two" },
    ];
    expect(cueOptions("w", characters, used)).toEqual([
      { cue: "Wren", note: null },
      { cue: "WAITER", note: "Used in this Chapter" },
      { cue: "WATCHMAN", note: "Used in Two" },
    ]);
  });

  it("offers nothing for a blank query", () => {
    expect(cueOptions(" ", characters, [])).toEqual([]);
  });

  it(`stops at ${CUES_SHOWN}`, () => {
    const used = Array.from({ length: 10 }, (_, i) => ({ cue: `GUARD ${i}`, chapter: null }));
    expect(cueOptions("g", [], used)).toHaveLength(CUES_SHOWN);
  });
});
