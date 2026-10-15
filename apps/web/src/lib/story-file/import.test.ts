import { describe, expect, it } from "vitest";
import { IMPORTED_AUTHOR, outlineSchema } from "@coscribe/editor";
import { importContent } from "./import";
import type { StoryFile } from "./types";

const imported = { userId: IMPORTED_AUTHOR, at: 1 };
const para = (text: string, marks: { type: string; attrs?: Record<string, unknown> }[] = []) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text, marks }] }],
});

const file: StoryFile = {
  title: "T",
  blurb: "",
  status: "draft",
  exported: "",
  chapters: [
    { title: "  ", content: para("Hi", [{ type: "bold" }, { type: "author", attrs: { userId: "x", at: 0 } }]) },
    { title: "x".repeat(200), content: para("Bye"), outline: { fields: [{ label: "Summary", content: para("S") }], characters: ["Mia", " "] } },
  ],
  entries: [
    { type: "character", name: "Mia", description: "d".repeat(300), aliases: ["M", "M", " ", ...Array.from({ length: 30 }, (_, i) => `a${i}`)], body: para("E") },
    { type: "lore", name: "  ", description: "", aliases: [], body: para("gone") },
  ],
};

describe("importContent", () => {
  const content = importContent(file, imported);

  it("credits every run to the given author, replacing any other", () => {
    expect(content.chapters[0]!.content.content![0]!.content![0]!.marks).toEqual([
      { type: "bold" },
      { type: "author", attrs: imported },
    ]);
    expect(content.entries[0]!.body.content![0]!.content![0]!.marks).toEqual([{ type: "author", attrs: imported }]);
  });

  it("leaves Outlines uncredited, since their schema has no author mark", () => {
    const outline = content.chapters[1]!.outline!.fields[0]!.content;
    expect(() => outlineSchema.nodeFromJSON(outline).check()).not.toThrow();
  });

  it("fits names to the tables' limits", () => {
    expect(content.chapters.map((c) => c.title.length)).toEqual([9, 120]);
    expect(content.chapters[0]!.title).toBe("Chapter 1");
    expect(content.chapters[1]!.outline!.characters).toEqual(["Mia"]);
    expect(content.entries).toHaveLength(1);
    expect(content.entries[0]!.description).toHaveLength(280);
    expect(content.entries[0]!.aliases.slice(0, 2)).toEqual(["M", "a0"]);
    expect(content.entries[0]!.aliases).toHaveLength(20);
  });
});
