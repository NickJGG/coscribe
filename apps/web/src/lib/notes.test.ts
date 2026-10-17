import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { chapterExtensions } from "@coscribe/editor";
import { groupNotes, markerGroups, NOTE_QUOTE_MAX, noteQuote, stackCards, type Note } from "./notes";

function note(id: string, created_at: string, resolved_at: string | null = null): Note {
  return {
    id,
    chapter_id: "c1",
    entry_id: null,
    author_id: "u1",
    quote: "quote",
    body: "body",
    edited_at: null,
    resolved_at,
    resolved_by: resolved_at ? "u2" : null,
    created_at,
  };
}

describe("noteQuote", () => {
  it("collapses whitespace across paragraphs", () => {
    expect(noteQuote("  The bells\n\nbegan  ")).toBe("The bells began");
  });

  it("cuts long passages to fit, with an ellipsis", () => {
    const quote = noteQuote("word ".repeat(100));
    expect([...quote].length).toBeLessThanOrEqual(NOTE_QUOTE_MAX);
    expect(quote.endsWith("d…")).toBe(true);
  });
});

describe("groupNotes", () => {
  it("splits open, Resolved, and detached Notes, each in its own order", () => {
    const notes = [
      note("late-in-doc", "2026-10-07T10:00:00Z"),
      note("early-in-doc", "2026-10-07T11:00:00Z"),
      note("gone", "2026-10-07T09:00:00Z"),
      note("resolved-first", "2026-10-07T08:00:00Z", "2026-10-07T12:00:00Z"),
      note("resolved-last", "2026-10-07T08:30:00Z", "2026-10-07T13:00:00Z"),
    ];
    const ranges = new Map([
      ["late-in-doc", { from: 40 }],
      ["early-in-doc", { from: 3 }],
      ["resolved-first", { from: 1 }],
    ]);
    const ids = (list: Note[]) => list.map((n) => n.id);
    const groups = groupNotes(notes, ranges);
    expect(ids(groups.open)).toEqual(["early-in-doc", "late-in-doc"]);
    expect(ids(groups.resolved)).toEqual(["resolved-last", "resolved-first"]);
    expect(ids(groups.detached)).toEqual(["gone"]);
  });

  it("orders Notes on the same passage oldest first", () => {
    const notes = [note("b", "2026-10-07T11:00:00Z"), note("a", "2026-10-07T10:00:00Z")];
    const ranges = new Map([
      ["a", { from: 5 }],
      ["b", { from: 5 }],
    ]);
    expect(groupNotes(notes, ranges).open.map((n) => n.id)).toEqual(["a", "b"]);
  });
});

describe("stackCards", () => {
  it("leaves cards that fit where they want to be", () => {
    expect(stackCards([0, 200, 400], [100, 100, 100], -1, 10)).toEqual([0, 200, 400]);
  });

  it("pushes later cards down past the one above", () => {
    expect(stackCards([0, 50, 60], [100, 40, 40], -1, 10)).toEqual([0, 110, 160]);
  });

  it("keeps the active card in place and pushes earlier ones up", () => {
    expect(stackCards([0, 50, 60], [100, 40, 40], 1, 10)).toEqual([-60, 50, 100]);
  });

  it("handles no cards", () => {
    expect(stackCards([], [], 0, 10)).toEqual([]);
  });
});

describe("markerGroups", () => {
  const schema = getSchema(chapterExtensions);
  const text = (t: string, ...ids: string[]) => ({
    type: "text",
    text: t,
    ...(ids.length && { marks: ids.map((id) => ({ type: "note", attrs: { id } })) }),
  });
  // "Ab cd ef" is 1..9, "Gh ij" is 11..16.
  const doc = schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "paragraph", content: [text("Ab ", "a"), text("cd", "a", "b"), text(" ef")] },
      { type: "paragraph", content: [text("Gh", "c"), text(" ij", "gone")] },
    ],
  });

  it("groups open Notes by the paragraph they start in, marked after the last passage", () => {
    expect(markerGroups(doc, new Set(["a", "b", "c"]))).toEqual([
      { ids: ["a", "b"], at: 6 },
      { ids: ["c"], at: 13 },
    ]);
  });

  it("leaves out Notes that aren't open", () => {
    expect(markerGroups(doc, new Set(["b"]))).toEqual([{ ids: ["b"], at: 6 }]);
  });
});
