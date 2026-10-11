import { describe, expect, it } from "vitest";
import { countMatches, indexStory, searchStory, snippet } from "./search";

const index = indexStory({
  typeOrder: ["character", "place", "item", "lore"],
  chapters: [
    { id: "c1", title: "The Lamp", blocks: ["Wren lit the lamp.", "The lamp went out, and the lamp was cold."] },
    { id: "c2", title: "Fog", blocks: ["Nothing here."] },
    { id: "c3", title: "Lamplight", blocks: [] },
  ],
  entries: [
    { id: "e2", type: "place", name: "Gull Point", aliases: [], description: "Where the lamp stands", blocks: [] },
    { id: "e1", type: "character", name: "Wren", aliases: ["the lamp girl"], description: "", blocks: ["Keeps the lamp."] },
  ],
});

describe("searchStory", () => {
  it("needs a query of at least two letters", () => {
    expect(searchStory(index, " l ")).toBeNull();
  });

  it("groups body matches by Chapter, numbering each Chapter's occurrences", () => {
    const results = searchStory(index, "LAMP")!;
    expect(results.total).toBe(4);
    expect(results.chapters.map((c) => [c.id, c.number, c.count])).toEqual([
      ["c1", 1, 3],
      ["c3", 3, 0],
    ]);
    expect(results.chapters[0]!.titleMatches).toEqual([{ from: 4, to: 8 }]);
    expect(results.chapters[0]!.snippets.map((s) => [s.n, s.before, s.match, s.after])).toEqual([
      [1, "Wren lit the ", "lamp", "."],
      [2, "The ", "lamp", " went out, and the lamp was cold."],
      [3, "The lamp went out, and the ", "lamp", " was cold."],
    ]);
  });

  it("lists Entries in the sidebar's order with the fields that matched", () => {
    const results = searchStory(index, "lamp")!;
    expect(results.entries.map((e) => [e.id, e.fields, e.count])).toEqual([
      ["e1", ["Alias", "body"], 1],
      ["e2", ["description"], 0],
    ]);
    expect(results.entries[0]!.snippet).toMatchObject({ n: 1, match: "lamp" });
    expect(results.entries[1]!.snippet).toMatchObject({ n: null, before: "Where the ", match: "lamp" });
  });

  it("finds names alone", () => {
    const results = searchStory(index, "gull")!;
    expect(results.total).toBe(0);
    expect(results.entries.map((e) => [e.id, e.fields, e.snippet])).toEqual([["e2", ["name"], null]]);
  });
});

describe("snippet", () => {
  it("trims long context to whole words", () => {
    const text = `${"word ".repeat(30)}lamp${" more".repeat(30)}`;
    const s = snippet(text, { from: 150, to: 154 }, 1);
    expect(s.before.startsWith("…word ")).toBe(true);
    expect(s.after.endsWith(" more…")).toBe(true);
    expect(s.before.length).toBeLessThanOrEqual(71);
  });
});

describe("countMatches", () => {
  it("counts body matches per document in Story order", () => {
    expect(countMatches(index, "lamp")).toEqual([
      { kind: "chapter", id: "c1", label: "Ch. 1", count: 3 },
      { kind: "chapter", id: "c2", label: "Ch. 2", count: 0 },
      { kind: "chapter", id: "c3", label: "Ch. 3", count: 0 },
      { kind: "entry", id: "e1", label: "Wren", count: 1 },
      { kind: "entry", id: "e2", label: "Gull Point", count: 0 },
    ]);
  });
});

describe("indexStory", () => {
  it("orders Entries by the Story's type order, keeping each type's incoming order", () => {
    const entry = (id: string, type: "character" | "place", name: string) => ({
      id,
      type,
      name,
      aliases: [],
      description: "",
      blocks: [],
    });
    const ordered = indexStory({
      typeOrder: ["place", "lore", "character", "item"],
      chapters: [],
      entries: [entry("c1", "character", "Zed"), entry("p1", "place", "Mill"), entry("c2", "character", "Abe")],
    });
    expect(ordered.entries.map((e) => e.id)).toEqual(["p1", "c1", "c2"]);
  });
});
