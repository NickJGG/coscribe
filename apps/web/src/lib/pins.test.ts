import { describe, expect, it } from "vitest";
import { visiblePins, withoutPin, withPin } from "./pins";

describe("withPin", () => {
  it("puts a new pin first", () => {
    expect(withPin(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("moves an existing pin to the front instead of repeating it", () => {
    expect(withPin(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
  });
});

describe("withoutPin", () => {
  it("removes the pin and keeps the order", () => {
    expect(withoutPin(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("leaves the list alone when it isn't pinned", () => {
    expect(withoutPin(["a"], "z")).toEqual(["a"]);
  });
});

describe("visiblePins", () => {
  it("drops pins whose Entry is gone and keeps pin order", () => {
    expect(visiblePins(["c", "gone", "a"], [{ id: "a" }, { id: "b" }, { id: "c" }])).toEqual(["c", "a"]);
  });
});
