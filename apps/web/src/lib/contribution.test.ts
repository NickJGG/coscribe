import { describe, expect, it } from "vitest";
import { IMPORTED_AUTHOR } from "@coscribe/editor";
import { paragraphShares, readAuthorChars, storyRibbon, type RibbonMember } from "./contribution";

const host: RibbonMember = { id: "h", name: "nick", color: "#d93f4c", role: "host", joinedAt: "2026-03-01" };
const early: RibbonMember = { id: "a", name: "maya", color: "#3e63dd", role: "writer", joinedAt: "2026-01-01" };
const late: RibbonMember = { id: "b", name: "theo", color: "#12a594", role: "cohost", joinedAt: "2026-05-01" };

describe("storyRibbon", () => {
  it("puts the Host first, then members by join order, never by size", () => {
    const ribbon = storyRibbon([late, early, host], [{ a: 5, b: 900 }, { h: 1, a: 10 }], new Map());
    expect(ribbon.map((s) => [s.id, s.chars])).toEqual([
      ["h", 1],
      ["a", 15],
      ["b", 900],
    ]);
  });

  it("adds former Writers at the end in grey, largest first", () => {
    const ribbon = storyRibbon([host], [{ h: 4, x: 2, y: 9 }], new Map([["y", "juno"]]));
    expect(ribbon).toEqual([
      { id: "h", name: "nick", color: "#d93f4c", chars: 4 },
      { id: "y", name: "juno", color: null, chars: 9 },
      { id: "x", name: "a former Writer", color: null, chars: 2 },
    ]);
  });

  it("leaves out members who haven't written anything", () => {
    expect(storyRibbon([host, early], [{ a: 3 }], new Map()).map((s) => s.id)).toEqual(["a"]);
  });

  it("has no segments for an empty Story", () => {
    expect(storyRibbon([host, early], [], new Map())).toEqual([]);
    expect(storyRibbon([host], [{}, {}], new Map())).toEqual([]);
  });
});

describe("readAuthorChars", () => {
  it("keeps positive numeric counts only", () => {
    expect(readAuthorChars({ a: 3, b: "4", c: 0, d: -1 })).toEqual({ a: 3 });
    expect(readAuthorChars({ a: 3, [IMPORTED_AUTHOR]: 50 })).toEqual({ a: 3 });
  });

  it("treats anything but an object as empty", () => {
    expect(readAuthorChars(null)).toEqual({});
    expect(readAuthorChars([1, 2])).toEqual({});
    expect(readAuthorChars("x")).toEqual({});
  });
});

describe("paragraphShares", () => {
  it("merges each author's runs, in order of first appearance", () => {
    const runs = [
      { author: "nick", chars: 90 },
      { author: "maya", chars: 7 },
      { author: "nick", chars: 21 },
      { author: "theo", chars: 29 },
      { author: "nick", chars: 15 },
    ];
    expect(paragraphShares(runs)).toEqual([
      { author: "nick", chars: 126 },
      { author: "maya", chars: 7 },
      { author: "theo", chars: 29 },
    ]);
  });

  it("gives a single-author paragraph one share", () => {
    expect(paragraphShares([{ author: "maya", chars: 140 }])).toEqual([{ author: "maya", chars: 140 }]);
  });

  it("skips empty runs, so an author appears where their first text does", () => {
    const runs = [
      { author: "juno", chars: 0 },
      { author: "theo", chars: 4 },
      { author: "juno", chars: 6 },
    ];
    expect(paragraphShares(runs).map((s) => s.author)).toEqual(["theo", "juno"]);
  });

  it("has no shares for an empty paragraph", () => {
    expect(paragraphShares([])).toEqual([]);
  });
});
