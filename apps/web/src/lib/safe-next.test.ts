import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/u/mia?tab=stories")).toBe("/u/mia?tab=stories");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "u/mia"])(
    "falls back for %s",
    (raw) => {
      expect(safeNext(raw, "/home")).toBe("/home");
    }
  );
});
