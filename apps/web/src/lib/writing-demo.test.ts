import { describe, expect, it } from "vitest";
import { AUTHORS, BIBLE, buildFrames, type DemoScript, type Frame, NOTES, peakFrames, type Step, TOGETHER } from "./writing-demo";

const text = (f: Frame, p: number) => f.paras[p].map((x) => x.c).join("");
const last = (s: DemoScript) => {
  const { frames } = buildFrames({ ...s, loop: "fade" });
  return frames[frames.length - 1];
};

describe("buildFrames", () => {
  it("shifts another Writer's caret when typing before it, not after", () => {
    const f = last({
      paras: [[["maya", "abcdef"]]],
      carets: { maya: [0, 2], theo: [0, 4], juno: [0, 1] },
      tracks: { maya: ["XY"] },
      loop: "fade",
      still: 0,
    });
    expect(text(f, 0)).toBe("abXYcdef");
    expect(f.carets).toEqual({
      maya: { p: 0, o: 4, visible: true },
      theo: { p: 0, o: 6, visible: true },
      juno: { p: 0, o: 1, visible: true },
    });
  });

  it("shifts carets at or after a deletion back", () => {
    const f = last({
      paras: [[["maya", "abcdef"]]],
      carets: { maya: [0, 4], theo: [0, 4], juno: [0, 6] },
      tracks: { maya: [{ del: 2 }] },
      loop: "fade",
      still: 0,
    });
    expect(text(f, 0)).toBe("abef");
    expect(f.carets.maya?.o).toBe(2);
    expect(f.carets.theo?.o).toBe(2);
    expect(f.carets.juno?.o).toBe(4);
  });

  it("splits the paragraph on enter and carries carets along", () => {
    const f = last({
      paras: [[["maya", "abcdef"]], [["theo", "xyz"]]],
      carets: { maya: [0, 2], theo: [0, 5], juno: [1, 1] },
      tracks: { maya: [{ enter: true }] },
      loop: "fade",
      still: 0,
    });
    expect(f.paras.map((_, p) => text(f, p))).toEqual(["ab", "cdef", "xyz"]);
    expect(f.carets).toEqual({
      maya: { p: 1, o: 0, visible: true },
      theo: { p: 1, o: 3, visible: true },
      juno: { p: 2, o: 1, visible: true },
    });
  });

  it("lets typing inherit a Note highlight from its neighbours", () => {
    const f = last({
      paras: [[["maya", "one two"]]],
      carets: { maya: [0, 0] },
      tracks: { maya: [{ mark: { p: 0, find: "one", prop: "h" } }, { at: [0, "one", "after"] }, "s"] },
      loop: "fade",
      still: 0,
    });
    expect(f.paras[0].filter((x) => x.h).map((x) => x.c).join("")).toBe("ones");
  });

  it("throws when `at` or `mark` can't find its target", () => {
    const build = (step: Step) =>
      buildFrames({ paras: [[["maya", "abc"]]], carets: { maya: [0, 0] }, tracks: { maya: [step] }, loop: "fade", still: 0 });
    expect(() => build({ at: [0, "zzz", "after"] })).toThrow();
    expect(() => build({ at: [3, "end"] })).toThrow();
    expect(() => build({ mark: { p: 0, find: "zzz", prop: "m" } })).toThrow();
  });
});

describe("the shipped demos", () => {
  it.each([
    ["TOGETHER", TOGETHER],
    ["NOTES", NOTES],
    ["AUTHORS", AUTHORS],
    ["BIBLE", BIBLE],
  ])("%s builds and its still frame is in range", (_, script) => {
    const { frames, still } = buildFrames(script);
    expect(still).toBeGreaterThan(0);
    expect(still).toBeLessThan(frames.length);
    expect(frames[still].fading).toBeUndefined();
  });

  it("rewinds TOGETHER back to its opening frame", () => {
    const { frames } = buildFrames(TOGETHER);
    expect(frames[frames.length - 1]).toEqual(frames[0]);
  });

  it.each([
    ["NOTES", NOTES],
    ["AUTHORS", AUTHORS],
    ["BIBLE", BIBLE],
  ])("%s fades out at the end of its loop", (_, script) => {
    const { frames } = buildFrames(script);
    expect(frames.slice(-6).every((f) => f.fading)).toBe(true);
    expect(frames[frames.length - 7].fading).toBeUndefined();
  });

  it("slips theo's \"tarred \" into maya's sentence while her caret stays at its end", () => {
    const { frames } = buildFrames(TOGETHER);
    const f = frames.find((x) => text(x, 0).includes("tarred "))!;
    expect(text(f, 0)).toBe(
      "The bells began at a quarter past two, when the sea had pulled back so far that Wren could see the old tarred pilin",
    );
    expect(f.paras[0].slice(-12, -5).map((x) => x.a)).toEqual(Array(7).fill("theo"));
    expect(f.carets.maya).toEqual({ p: 0, o: f.paras[0].length, visible: true });
    expect(f.carets.theo).toEqual({ p: 0, o: f.paras[0].length - 5, visible: true });

    const done = frames.find((x) => text(x, 0).endsWith("the old tarred pilings."));
    expect(done?.carets.maya?.o).toBe(done?.paras[0].length);
  });

  it("gets maya's new paragraph under theo's line", () => {
    const { frames } = buildFrames(TOGETHER);
    const f = frames.find((x) => x.paras.length === 3 && text(x, 2) === "Nobody had painted the eleventh.");
    expect(f && text(f, 1)).toBe("Eleven. There were only ever ten bells on the spit, and Wren had painted every one of them.");
  });
});

describe("peakFrames", () => {
  it("keeps the fullest frame for each set of flags", () => {
    const peaks = peakFrames(buildFrames(NOTES));
    const resolving = peaks.find((f) => f.flags.resolveShown && !f.flags.resolved);
    expect(resolving?.fields).toEqual({ nt: "Wasn't it ten in Chapter 1?", nr: "It was. Fixing it." });
    expect(peakFrames(buildFrames(BIBLE)).some((f) => f.flags.entryCard)).toBe(true);
  });
});
