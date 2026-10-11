import { describe, expect, it } from "vitest";
import { authorIds, creditLines, tallyAuthors } from "./credits";

const text = (text: string, userId: string) => ({ type: "text", text, marks: [{ type: "author", attrs: { userId, at: 1 } }] });
const doc = (...runs: ReturnType<typeof text>[]) => ({ type: "doc", content: [{ type: "paragraph", content: runs }] });

const mia = { id: "mia", username: "mia", author_color: "#b5441a" };
const jordan = { id: "jordan", username: "jordan", author_color: "#3e63dd" };
const sam = { id: "sam", username: "sam", author_color: "#2f7a3e" };

const content = {
  chapter: { c1: doc(text("Once upon a time", "mia"), text(" there", "jordan")), c2: doc(text("The end.", "gone")) },
  entry: { e1: doc(text("A dragon", "jordan")) },
};

describe("credits", () => {
  it("tallies Chapters and the Story Bible separately", () => {
    const tally = tallyAuthors(content);
    expect(Object.fromEntries(tally.chapters)).toEqual({ mia: 16, jordan: 6, gone: 8 });
    expect(Object.fromEntries(tally.bible)).toEqual({ jordan: 8 });
    expect(authorIds(tally).sort()).toEqual(["gone", "jordan", "mia"]);
  });

  it("lists members who wrote nothing and former Writers, most Chapter text first", () => {
    const lines = creditLines(tallyAuthors(content), ["mia", "jordan", "sam"], [mia, jordan, sam]);
    expect(lines.map((l) => [l.id, l.chapters, l.bible, l.person?.username ?? null])).toEqual([
      ["mia", 16, 0, "mia"],
      ["gone", 8, 0, null],
      ["jordan", 6, 8, "jordan"],
      ["sam", 0, 0, "sam"],
    ]);
  });

  it("lists Viewers only when their text survives", () => {
    const lines = creditLines(tallyAuthors(content), ["mia"], [mia, jordan, sam]);
    expect(lines.map((l) => l.id)).toEqual(["mia", "gone", "jordan"]);
  });
});
