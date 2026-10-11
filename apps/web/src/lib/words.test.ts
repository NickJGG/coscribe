import { describe, expect, it } from "vitest";
import { readingTime } from "./words";

describe("readingTime", () => {
  it("has nothing for no words", () => {
    expect(readingTime(0)).toBeNull();
  });

  it("rounds minutes up under an hour", () => {
    expect(readingTime(1)).toBe("1 min");
    expect(readingTime(250)).toBe("1 min");
    expect(readingTime(251)).toBe("2 min");
  });

  it("shows hours and the nearest 5 minutes up to 10 hours", () => {
    expect(readingTime(14_999)).toBe("1 hr");
    expect(readingTime(15_000)).toBe("1 hr");
    expect(readingTime(17_000)).toBe("1 hr 10 min");
    expect(readingTime(48_210)).toBe("3 hr 15 min");
    expect(readingTime(149_000)).toBe("9 hr 55 min");
    expect(readingTime(149_900)).toBe("10 hr");
  });

  it("shows whole hours from 10 hours", () => {
    expect(readingTime(210_000)).toBe("14 hr");
  });
});
