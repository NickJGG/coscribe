import { describe, expect, it } from "vitest";
import { daysLeft, parseTrashed } from "./trash";

const NOW = Date.parse("2026-10-13T12:00:00Z");
const inDays = (days: number) => new Date(NOW + days * 24 * 3600 * 1000).toISOString();

describe("daysLeft", () => {
  it("rounds up to whole days", () => {
    expect(daysLeft(inDays(30), NOW)).toBe("30 days left");
    expect(daysLeft(inDays(29.2), NOW)).toBe("30 days left");
    expect(daysLeft(inDays(1.5), NOW)).toBe("2 days left");
  });

  it("says one day until it's gone", () => {
    expect(daysLeft(inDays(0.1), NOW)).toBe("1 day left");
    expect(daysLeft(inDays(-0.1), NOW)).toBe("1 day left");
  });
});

describe("parseTrashed", () => {
  const id = "0b7c6a52-3f0e-4c4e-9a43-6d2f1b8e5a10";

  it("reads what a delete redirects with", () => {
    expect(parseTrashed(`chapter:${id}`)).toEqual({ kind: "chapter", id });
    expect(parseTrashed(`entry:${id}`)).toEqual({ kind: "entry", id });
    expect(parseTrashed(`story:${id}`)).toEqual({ kind: "story", id });
  });

  it("ignores anything else", () => {
    expect(parseTrashed(undefined)).toBeNull();
    expect(parseTrashed([`chapter:${id}`])).toBeNull();
    expect(parseTrashed(`note:${id}`)).toBeNull();
    expect(parseTrashed("chapter:nope")).toBeNull();
  });
});
