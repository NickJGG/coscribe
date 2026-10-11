import { describe, expect, it } from "vitest";
import {
  AUTHOR_COLOR_DARK,
  AUTHOR_COLORS,
  authorColorVars,
  BIO_MAX,
  bioError,
  isAuthorColor,
  normalizeBio,
  nextFreeColor,
  normalizeUsername,
  usernameError,
} from "./profile-rules";

describe("usernameError", () => {
  it.each(["mia", "jordan_92", "a".repeat(20)])("accepts %s", (name) => {
    expect(usernameError(name)).toBeNull();
  });

  it.each(["ab", "a".repeat(21), "mia!", "has space", "Mia", "émile"])("rejects %s", (name) => {
    expect(usernameError(name)).not.toBeNull();
  });
});

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Mia_Writes ")).toBe("mia_writes");
  });
});

describe("normalizeBio", () => {
  it.each([
    ["  Writes ghost stories. ", "Writes ghost stories."],
    ["Two\nlines,   one\tline", "Two lines, one line"],
    ["", null],
    ["   \n ", null],
  ])("normalizes %j", (raw, bio) => {
    expect(normalizeBio(raw)).toBe(bio);
  });
});

describe("bioError", () => {
  it.each([null, "a", "a".repeat(BIO_MAX)])("accepts %j", (bio) => {
    expect(bioError(bio)).toBeNull();
  });

  it.each(["a".repeat(BIO_MAX + 1)])("rejects %j", (bio) => {
    expect(bioError(bio)).not.toBeNull();
  });
});

describe("isAuthorColor", () => {
  it("accepts palette colors only", () => {
    expect(isAuthorColor("#3e63dd")).toBe(true);
    expect(isAuthorColor("#3E63DD")).toBe(false);
    expect(isAuthorColor("#123456")).toBe(false);
  });
});

describe("AUTHOR_COLOR_DARK", () => {
  it("has a distinct dark twin for every palette color", () => {
    const darks = AUTHOR_COLORS.map((c) => AUTHOR_COLOR_DARK[c]);
    expect(darks.every((d) => /^#[0-9a-f]{6}$/.test(d))).toBe(true);
    expect(new Set(darks).size).toBe(AUTHOR_COLORS.length);
  });
});

describe("authorColorVars", () => {
  it("pairs a palette color with its dark twin", () => {
    expect(authorColorVars("#3e63dd")).toEqual({ light: "#3e63dd", dark: AUTHOR_COLOR_DARK["#3e63dd"] });
  });

  it("uses an unknown color in both themes", () => {
    expect(authorColorVars("#123456")).toEqual({ light: "#123456", dark: "#123456" });
  });
});

describe("nextFreeColor", () => {
  const palette = ["#a", "#b", "#c", "#d"];

  it("keeps the preferred color when it's free", () => {
    expect(nextFreeColor(palette, ["#a", "#c"], "#b")).toBe("#b");
  });

  it("takes the next free color after the preferred one", () => {
    expect(nextFreeColor(palette, ["#b", "#c"], "#b")).toBe("#d");
  });

  it("wraps around the palette", () => {
    expect(nextFreeColor(palette, ["#d", "#a"], "#d")).toBe("#b");
  });

  it("falls back to the preferred color when every color is taken", () => {
    expect(nextFreeColor(palette, palette, "#c")).toBe("#c");
  });

  it("starts from the top for a color outside the palette", () => {
    expect(nextFreeColor(palette, ["#z", "#b"], "#z")).toBe("#a");
  });
});
