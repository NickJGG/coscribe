import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const NOW = new Date("2026-10-07T12:00:00Z").getTime();
const ago = (seconds: number) => relativeTime(NOW - seconds * 1000, NOW);

describe("relativeTime", () => {
  it("says just now under a minute", () => {
    expect(ago(0)).toBe("just now");
    expect(ago(59)).toBe("just now");
  });

  it("uses the largest whole unit", () => {
    expect(ago(60)).toBe("1 minute ago");
    expect(ago(5 * 60 + 30)).toBe("5 minutes ago");
    expect(ago(2 * 3600)).toBe("2 hours ago");
    expect(ago(24 * 3600)).toBe("yesterday");
    expect(ago(21 * 24 * 3600)).toBe("3 weeks ago");
  });
});
