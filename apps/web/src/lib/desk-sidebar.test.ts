import { describe, expect, it } from "vitest";
import { parseCollapsed, parseSidebarWidth, sidebarCookie, SIDEBAR_MIN_PX, WIDTH_COOKIE } from "./desk-sidebar";

describe("parseSidebarWidth", () => {
  it("uses the default when there's no cookie", () => {
    expect(parseSidebarWidth(undefined)).toBeNull();
    expect(parseSidebarWidth("")).toBeNull();
  });

  it("keeps whole widths from the minimum up", () => {
    expect(parseSidebarWidth(String(SIDEBAR_MIN_PX))).toBe(SIDEBAR_MIN_PX);
    expect(parseSidebarWidth("400")).toBe(400);
    expect(parseSidebarWidth("4000")).toBe(4000);
  });

  it("ignores garbage, negatives, floats and widths below the minimum", () => {
    for (const raw of ["wide", "300px", "-300", "300.5", "1e3", " 300", "255", "0", "99999999999999999999"]) {
      expect(parseSidebarWidth(raw)).toBeNull();
    }
  });
});

describe("parseCollapsed", () => {
  it("is collapsed only for 1", () => {
    expect(parseCollapsed("1")).toBe(true);
    expect(parseCollapsed("0")).toBe(false);
    expect(parseCollapsed("true")).toBe(false);
    expect(parseCollapsed(undefined)).toBe(false);
  });
});

describe("sidebarCookie", () => {
  it("keeps a value for a year across the site", () => {
    expect(sidebarCookie(WIDTH_COOKIE, "320")).toBe(
      "coscribe-sidebar-width=320; path=/; max-age=31536000; samesite=lax"
    );
  });

  it("clears with a zero max-age", () => {
    expect(sidebarCookie(WIDTH_COOKIE, null)).toBe("coscribe-sidebar-width=; path=/; max-age=0; samesite=lax");
  });
});
