import { describe, expect, it } from "vitest";
import { toXhtml } from "./html";

describe("toXhtml", () => {
  it("escapes text and writes ProseView's markup, without authorship", () => {
    expect(
      toXhtml({
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { textAlign: "center" },
            content: [
              { type: "text", text: "Tom & <Jerry> \"run\"", marks: [{ type: "author", attrs: { userId: "u1" } }] },
              { type: "text", text: "!", marks: [{ type: "bold" }, { type: "italic" }] },
              { type: "hardBreak" },
              { type: "text", text: "Next line" },
            ],
          },
          { type: "sceneBreak" },
          { type: "script", content: [{ type: "scriptElement", attrs: { element: "character" }, content: [{ type: "text", text: "ANNA" }] }] },
          { type: "orderedList", attrs: { start: 2 }, content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
        ],
      })
    ).toBe(
      '<p style="text-align: center">Tom &amp; &lt;Jerry&gt; &quot;run&quot;<em><strong>!</strong></em><br />Next line</p>\n' +
        '<hr data-scene-break="" />\n' +
        '<div data-script=""><p data-element="character">ANNA</p></div>\n' +
        '<ol start="2"><li><p></p></li></ol>'
    );
  });
});
