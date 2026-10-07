import { describe, expect, it } from "vitest";
import { shortWords } from "./words";

describe("shortWords", () => {
  it("shows short Chapters exactly", () => {
    expect(shortWords(0)).toBe("0");
    expect(shortWords(99)).toBe("99");
  });

  it("shows longer Chapters in thousands", () => {
    expect(shortWords(100)).toBe("0.1k");
    expect(shortWords(820)).toBe("0.8k");
    expect(shortWords(3149)).toBe("3.1k");
    expect(shortWords(12_000)).toBe("12.0k");
  });
});
