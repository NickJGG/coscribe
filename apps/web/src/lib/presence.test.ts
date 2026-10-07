import { describe, expect, it } from "vitest";
import { joinNames, presentWriters, writingLine, type PresenceRow } from "./presence";

const row = (id: string, user_id: string, document_id: string, connected_at: string): PresenceRow => ({
  id,
  user_id,
  kind: "chapter",
  document_id,
  connected_at,
});

describe("presentWriters", () => {
  it("lists each Writer once, by arrival, at their latest document", () => {
    const rows = [
      row("1", "theo", "c2", "2026-10-07T10:05:00Z"),
      row("2", "mia", "c1", "2026-10-07T10:01:00Z"),
      row("3", "theo", "c1", "2026-10-07T10:00:00Z"),
    ];
    expect(presentWriters(rows)).toEqual([
      { userId: "theo", kind: "chapter", documentId: "c2" },
      { userId: "mia", kind: "chapter", documentId: "c1" },
    ]);
  });

  it("leaves out me", () => {
    const rows = [row("1", "me", "c1", "2026-10-07T10:00:00Z"), row("2", "mia", "c1", "2026-10-07T10:01:00Z")];
    expect(presentWriters(rows, "me").map((p) => p.userId)).toEqual(["mia"]);
  });
});

describe("joinNames", () => {
  it("joins up to three names, then counts the rest", () => {
    expect(joinNames(["mia"])).toBe("mia");
    expect(joinNames(["mia", "theo"])).toBe("mia and theo");
    expect(joinNames(["mia", "theo", "sam"])).toBe("mia, theo and sam");
    expect(joinNames(["mia", "theo", "sam", "jo"])).toBe("mia, theo and 2 others");
  });
});

describe("writingLine", () => {
  it("is null when nobody is there", () => {
    expect(writingLine([])).toBeNull();
  });

  it("names the Chapter when everyone is in the same one", () => {
    expect(writingLine([{ name: "theo", chapter: 3 }])).toBe("theo is writing Chapter 3");
    expect(
      writingLine([
        { name: "theo", chapter: 3 },
        { name: "mia", chapter: 3 },
      ])
    ).toBe("theo and mia are writing Chapter 3");
  });

  it("drops the Chapter when they're spread out", () => {
    expect(
      writingLine([
        { name: "theo", chapter: 3 },
        { name: "mia", chapter: null },
      ])
    ).toBe("theo and mia are writing");
  });

  it("says Story Bible when that's where they are", () => {
    expect(writingLine([{ name: "theo", chapter: null }])).toBe("theo is in the Story Bible");
  });
});
