import { describe, expect, it } from "vitest";
import { monthYear, recentlyEdited } from "./overview";

describe("monthYear", () => {
  it("names the month and year", () => {
    expect(monthYear("2026-03-14T09:30:00+00:00")).toBe("March 2026");
  });

  it("reads timestamps in UTC", () => {
    expect(monthYear("2026-04-01T00:30:00+00:00")).toBe("April 2026");
  });
});

describe("recentlyEdited", () => {
  const chapters = [
    { id: "a", edited_at: "2026-10-01T10:00:00+00:00" },
    { id: "b", edited_at: null },
    { id: "c", edited_at: "2026-10-05T10:00:00+00:00" },
    { id: "d", edited_at: "2026-10-03T10:00:00+00:00" },
    { id: "e", edited_at: "2026-09-01T10:00:00+00:00" },
  ];

  it("takes the newest three, with reading-order numbers", () => {
    expect(recentlyEdited(chapters).map(({ chapter, number }) => [chapter.id, number])).toEqual([
      ["c", 3],
      ["d", 4],
      ["a", 1],
    ]);
  });

  it("leaves out Chapters never edited", () => {
    expect(recentlyEdited([{ edited_at: null }])).toEqual([]);
    expect(recentlyEdited(chapters, 10).map(({ chapter }) => chapter.id)).toEqual(["c", "d", "a", "e"]);
  });
});
