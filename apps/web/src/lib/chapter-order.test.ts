import { describe, expect, it } from "vitest";
import { afterId, moveTargets, placeAfter } from "./chapter-order";

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

describe("placeAfter", () => {
  const order = ["character", "place", "item", "lore"];

  it("moves to first when after is null", () => {
    expect(placeAfter(order, "item", null)).toEqual(["item", "character", "place", "lore"]);
  });

  it("moves down past its neighbor", () => {
    expect(placeAfter(order, "character", "place")).toEqual(["place", "character", "item", "lore"]);
  });

  it("keeps a skipped item's slot", () => {
    expect(placeAfter(order, "lore", "character")).toEqual(["character", "lore", "place", "item"]);
  });
});
