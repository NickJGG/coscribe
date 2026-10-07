import { describe, expect, it } from "vitest";
import { filterEntries, readEntryFields } from "./entries";

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

describe("filterEntries", () => {
  const entries = [
    { type: "character" as const, name: "Mia Okafor" },
    { type: "character" as const, name: "Jordan" },
    { type: "place" as const, name: "Café Mira" },
  ];

  it("matches every word of the query against the name, ignoring case and accents", () => {
    expect(filterEntries(entries, "MI", null).map((e) => e.name)).toEqual(["Mia Okafor", "Café Mira"]);
    expect(filterEntries(entries, "cafe", null).map((e) => e.name)).toEqual(["Café Mira"]);
    expect(filterEntries(entries, "okafor mia", null).map((e) => e.name)).toEqual(["Mia Okafor"]);
  });

  it("narrows by type, and an empty query matches everything", () => {
    expect(filterEntries(entries, "", "character")).toHaveLength(2);
    expect(filterEntries(entries, "  ", null)).toHaveLength(3);
    expect(filterEntries(entries, "mi", "place").map((e) => e.name)).toEqual(["Café Mira"]);
  });
});
