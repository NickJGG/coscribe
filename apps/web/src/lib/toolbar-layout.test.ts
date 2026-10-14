import { describe, expect, it } from "vitest";
import { DEFAULT_TOOLBAR_LAYOUT, isDefaultLayout, resolveToolbarLayout } from "./toolbar-layout";

describe("resolveToolbarLayout", () => {
  it("gives the default for null", () => {
    expect(resolveToolbarLayout(null)).toEqual(DEFAULT_TOOLBAR_LAYOUT);
  });

  it("keeps a valid custom layout", () => {
    const custom = [
      ["note", ["addNote"]],
      ["lists", ["orderedList", "bulletList"]],
      ["inline", ["strike", "bold", "italic"]],
      ["block", ["align", "script", "lineBreak", "sceneBreak", "blockquote"]],
    ];
    expect(resolveToolbarLayout(custom)).toEqual(custom);
  });

  it("appends a tool missing from its group, and a missing group at the end", () => {
    expect(
      resolveToolbarLayout([
        ["block", ["blockquote", "sceneBreak"]],
        ["inline", ["italic", "bold", "strike"]],
      ])
    ).toEqual([
      ["block", ["blockquote", "sceneBreak", "lineBreak", "script", "align"]],
      ["inline", ["italic", "bold", "strike"]],
      ["lists", ["bulletList", "orderedList"]],
      ["note", ["addNote"]],
    ]);
  });

  it("adds the Script tool to a layout saved before it existed", () => {
    expect(resolveToolbarLayout([["block", ["align", "sceneBreak", "lineBreak", "blockquote"]]])[0]).toEqual([
      "block",
      ["align", "sceneBreak", "lineBreak", "blockquote", "script"],
    ]);
  });

  it("adds the Line break tool to a layout saved before it existed, at the end of its group", () => {
    expect(resolveToolbarLayout([["block", ["align", "script", "sceneBreak", "blockquote"]]])[0]).toEqual([
      "block",
      ["align", "script", "sceneBreak", "blockquote", "lineBreak"],
    ]);
  });

  it("drops unknown groups and tools", () => {
    expect(
      resolveToolbarLayout([
        ["gone", ["bold"]],
        ["note", ["sparkle", "addNote"]],
      ])
    ).toEqual([["note", ["addNote"]], ...DEFAULT_TOOLBAR_LAYOUT.filter(([g]) => g !== "note")]);
  });

  it("ignores a tool saved under another group", () => {
    const layout = resolveToolbarLayout([["inline", ["addNote", "italic"]]]);
    expect(layout[0]).toEqual(["inline", ["italic", "bold", "strike"]]);
    expect(layout.find(([g]) => g === "note")).toEqual(["note", ["addNote"]]);
  });

  it("keeps the first of duplicated groups and tools", () => {
    expect(
      resolveToolbarLayout([
        ["inline", ["italic", "italic", "bold"]],
        ["inline", ["strike"]],
      ])[0]
    ).toEqual(["inline", ["italic", "bold", "strike"]]);
  });

  it("gives the default for junk", () => {
    for (const junk of [undefined, 3, "inline", { inline: [] }, [3, "x", [null], ["inline", "bold"]]]) {
      expect(resolveToolbarLayout(junk)).toEqual(DEFAULT_TOOLBAR_LAYOUT);
    }
  });
});

describe("isDefaultLayout", () => {
  it("tells the default from a custom order", () => {
    expect(isDefaultLayout(resolveToolbarLayout(null))).toBe(true);
    expect(isDefaultLayout(resolveToolbarLayout([["note", []]]))).toBe(false);
  });
});
