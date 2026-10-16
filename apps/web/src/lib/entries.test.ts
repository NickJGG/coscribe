import { describe, expect, it } from "vitest";
import { entryGroups, readEntryFields, readEntryPatch } from "./entries";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

describe("readEntryFields", () => {
  it("trims and accepts a valid Entry", () => {
    expect(readEntryFields(form({ type: "place", name: "  The Mill ", description: " Burned down. " }))).toEqual({
      fields: { type: "place", name: "The Mill", description: "Burned down." },
    });
  });

  it("treats a missing description as empty", () => {
    expect(readEntryFields(form({ type: "lore", name: "The Pact" }))).toEqual({
      fields: { type: "lore", name: "The Pact", description: "" },
    });
  });

  it("rejects unknown types, blank or long names, and long descriptions", () => {
    expect(readEntryFields(form({ type: "weapon", name: "Sword" }))).toHaveProperty("error");
    expect(readEntryFields(form({ type: "item", name: "   " }))).toHaveProperty("error");
    expect(readEntryFields(form({ type: "item", name: "x".repeat(81) }))).toHaveProperty("error");
    expect(readEntryFields(form({ type: "item", name: "Sword", description: "x".repeat(281) }))).toHaveProperty("error");
  });
});

describe("readEntryPatch", () => {
  it("maps only the fields sent", () => {
    expect(readEntryPatch({ name: " Wren ", linkEntryMentions: false })).toEqual({
      columns: { name: "Wren", link_entry_mentions: false },
    });
    expect(readEntryPatch({})).toEqual({ columns: {} });
  });

  it("tidies Aliases and drops blanks and repeats", () => {
    expect(readEntryPatch({ aliases: ["  the  old keeper ", "", "Aldous", "ALDOUS", "Áldous"] })).toEqual({
      columns: { aliases: ["the old keeper", "Aldous", "Áldous"] },
    });
  });

  it("rejects long or too many Aliases and bad fields", () => {
    expect(readEntryPatch({ aliases: ["x".repeat(81)] })).toHaveProperty("error");
    expect(readEntryPatch({ aliases: Array.from({ length: 21 }, (_, i) => `a${i}`) })).toHaveProperty("error");
    expect(readEntryPatch({ name: "  " })).toHaveProperty("error");
    expect(readEntryPatch({ type: "weapon" as never })).toHaveProperty("error");
    expect(readEntryPatch({ description: "x".repeat(281) })).toHaveProperty("error");
  });

  it("maps a Voice to its columns and rejects unknown kinds and pitches", () => {
    expect(readEntryPatch({ voice: { kind: "feminine", pitch: -1 } })).toEqual({
      columns: { voice_kind: "feminine", voice_pitch: -1 },
    });
    expect(readEntryPatch({ voice: { kind: null, pitch: 0 } })).toEqual({ columns: { voice_kind: null, voice_pitch: 0 } });
    expect(readEntryPatch({ voice: { kind: "robot" as never, pitch: 0 } })).toHaveProperty("error");
    expect(readEntryPatch({ voice: { kind: null, pitch: 2 as never } })).toHaveProperty("error");
    expect(readEntryPatch({ voice: null as never })).toHaveProperty("error");
  });
});

describe("entryGroups", () => {
  const entries = [
    { id: "c1", type: "character" as const },
    { id: "l1", type: "lore" as const },
    { id: "c2", type: "character" as const },
  ];

  it("follows the type order and drops empty types", () => {
    expect(entryGroups(entries, ["lore", "place", "character", "item"])).toEqual([
      { type: "lore", entries: [{ id: "l1", type: "lore" }] },
      {
        type: "character",
        entries: [
          { id: "c1", type: "character" },
          { id: "c2", type: "character" },
        ],
      },
    ]);
  });

  it("is empty with no Entries", () => {
    expect(entryGroups([], ["character", "place", "item", "lore"])).toEqual([]);
  });
});
