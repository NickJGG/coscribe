import { describe, expect, it } from "vitest";
import { BLURB_MAX, readStoryForm } from "./story-form";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("readStoryForm", () => {
  it("trims the title and blurb", () => {
    expect(readStoryForm(form({ title: "  The Lighthouse ", blurb: " Two keepers, one lamp. " }))).toEqual({
      title: "The Lighthouse",
      visibility: "private",
      blurb: "Two keepers, one lamp.",
      error: null,
    });
  });

  it.each<Record<string, string>>([{}, { blurb: "" }, { blurb: "   " }])("treats a missing or blank blurb as null", (fields) => {
    expect(readStoryForm(form({ title: "T", ...fields })).blurb).toBeNull();
  });

  it("accepts a blurb at the limit and rejects one past it", () => {
    expect(readStoryForm(form({ title: "T", blurb: "a".repeat(BLURB_MAX) })).error).toBeNull();
    expect(readStoryForm(form({ title: "T", blurb: "a".repeat(BLURB_MAX + 1) })).error).toMatch(/blurb/);
  });

  it("reports a title problem before a blurb one", () => {
    expect(readStoryForm(form({ title: " ", blurb: "a".repeat(BLURB_MAX + 1) })).error).toMatch(/title/);
  });

  it("only reads public visibility as public", () => {
    expect(readStoryForm(form({ title: "T", visibility: "public" })).visibility).toBe("public");
    expect(readStoryForm(form({ title: "T", visibility: "secret" })).visibility).toBe("private");
  });
});
