import { describe, expect, it } from "vitest";
import { cellTip, daysInLastYear, HEATMAP_WEEKS, heatmapWeeks, level, streaks, type WritingDay } from "./writing-days";

// A Thursday.
const TODAY = "2026-10-15";

describe("streaks", () => {
  it("counts today and back", () => {
    const days: WritingDay[] = [["2026-10-13", 5], ["2026-10-14", 5], ["2026-10-15", 5]];
    expect(streaks(days, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it("stays alive from yesterday when today isn't written yet", () => {
    const days: WritingDay[] = [["2026-10-13", 5], ["2026-10-14", 5]];
    expect(streaks(days, TODAY).current).toBe(2);
  });

  it("ends after a whole day without writing", () => {
    const days: WritingDay[] = [["2026-10-12", 5], ["2026-10-13", 5]];
    expect(streaks(days, TODAY).current).toBe(0);
  });

  it("breaks a run at a gap", () => {
    const days: WritingDay[] = [["2026-10-10", 5], ["2026-10-11", 5], ["2026-10-13", 5], ["2026-10-14", 5], ["2026-10-15", 5]];
    expect(streaks(days, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it("finds an all-time longest older than the grid, across a month end", () => {
    const days: WritingDay[] = [
      ["2024-01-30", 5],
      ["2024-01-31", 5],
      ["2024-02-01", 5],
      ["2024-02-02", 5],
      ["2026-10-15", 5],
    ];
    expect(streaks(days, TODAY)).toEqual({ current: 1, longest: 4 });
  });

  it("is zero with no days", () => {
    expect(streaks([], TODAY)).toEqual({ current: 0, longest: 0 });
  });
});

describe("heatmapWeeks", () => {
  const weeks = heatmapWeeks([["2026-10-14", 47], ["2025-10-12", 3]], TODAY);

  it("ends on today's week, Sunday first, with later days empty", () => {
    expect(weeks).toHaveLength(HEATMAP_WEEKS);
    const last = weeks.at(-1)!.days;
    expect(last[0]!.date).toBe("2026-10-11");
    expect(last[4]!.date).toBe(TODAY);
    expect(last.slice(5)).toEqual([null, null]);
  });

  it("starts 52 weeks before that Sunday", () => {
    expect(weeks[0]!.days[0]!.date).toBe("2025-10-12");
    expect(weeks[0]!.days[0]!.level).toBe(1);
  });

  it("shades written days", () => {
    expect(weeks.at(-1)!.days[3]).toEqual({ date: "2026-10-14", minutes: 47, level: 3 });
  });

  it("labels the first week of each month", () => {
    const labelled = weeks.flatMap((w) => (w.month ? [[w.month, w.days[0]!.date]] : []));
    expect(labelled[0]).toEqual(["Nov", "2025-11-02"]);
    expect(labelled).toHaveLength(11);
  });
});

describe("level", () => {
  it("steps at 15, 45 and 90 minutes", () => {
    expect([0, 1, 15, 16, 45, 46, 90, 91].map(level)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe("daysInLastYear", () => {
  it("counts the 365 days up to today", () => {
    const days: WritingDay[] = [["2025-10-15", 5], ["2025-10-16", 5], ["2026-10-15", 5], ["2026-10-01", 0]];
    expect(daysInLastYear(days, TODAY)).toBe(2);
  });
});

describe("cellTip", () => {
  it("says the minutes and the day", () => {
    expect(cellTip({ date: "2026-10-06", minutes: 47, level: 3 })).toBe("47 minutes writing on Tue, Oct 6");
    expect(cellTip({ date: "2026-10-06", minutes: 1, level: 1 })).toBe("1 minute writing on Tue, Oct 6");
    expect(cellTip({ date: "2026-10-06", minutes: 0, level: 0 })).toBe("No writing on Tue, Oct 6");
  });
});
