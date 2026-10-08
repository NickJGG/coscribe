import { describe, expect, it } from "vitest";
import { afterId, moveTargets } from "./chapter-order";

describe("moveTargets", () => {
  const ids = ["a", "b", "c", "d"];

  it("can't move the first Chapter up", () => {
    expect(moveTargets(ids, 0)).toEqual({ up: undefined, down: "b" });
  });

  it("moves the second Chapter up to first", () => {
    expect(moveTargets(ids, 1)).toEqual({ up: null, down: "c" });
  });

  it("moves a middle Chapter after its neighbors' neighbors", () => {
    expect(moveTargets(ids, 2)).toEqual({ up: "a", down: "d" });
  });

  it("can't move the last Chapter down", () => {
    expect(moveTargets(ids, 3)).toEqual({ up: "b", down: undefined });
  });

  it("can't move the only Chapter", () => {
    expect(moveTargets(["a"], 0)).toEqual({ up: undefined, down: undefined });
  });
});

describe("afterId", () => {
  it("is null at the top", () => {
    expect(afterId(["a", "b"], 0)).toBeNull();
  });

  it("names the Chapter before", () => {
    expect(afterId(["a", "b", "c"], 2)).toBe("b");
  });
});
