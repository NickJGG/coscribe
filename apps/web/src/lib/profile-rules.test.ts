import { describe, expect, it } from "vitest";
import { isAuthorColor, normalizeUsername, usernameError } from "./profile-rules";

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

describe("isAuthorColor", () => {
  it("accepts palette colors only", () => {
    expect(isAuthorColor("#3e63dd")).toBe(true);
    expect(isAuthorColor("#3E63DD")).toBe(false);
    expect(isAuthorColor("#123456")).toBe(false);
  });
});
