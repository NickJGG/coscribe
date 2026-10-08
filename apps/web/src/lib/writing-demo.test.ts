import { describe, expect, it } from "vitest";
import { DEMO_BASE, DEMO_FULL, demoLength } from "./writing-demo";

const span = DEMO_FULL.length - DEMO_BASE.length;
const cycle = 2 * span + 42;

describe("demoLength", () => {
  it("starts at the still frame", () => {
    expect(demoLength(0)).toBe(DEMO_BASE.length);
  });

  it("types one character a tick, then holds the full line", () => {
    expect(demoLength(5)).toBe(DEMO_BASE.length + 5);
    expect(demoLength(span)).toBe(DEMO_FULL.length);
    expect(demoLength(span + 30)).toBe(DEMO_FULL.length);
  });

  it("deletes back to the base line and holds it", () => {
    expect(demoLength(span + 31)).toBe(DEMO_FULL.length - 1);
    expect(demoLength(2 * span + 30)).toBe(DEMO_BASE.length);
    expect(demoLength(cycle - 1)).toBe(DEMO_BASE.length);
  });

  it("repeats", () => {
    expect(demoLength(cycle)).toBe(DEMO_BASE.length);
    expect(demoLength(cycle + 7)).toBe(demoLength(7));
  });
});
