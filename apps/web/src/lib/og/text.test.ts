import { describe, expect, it } from "vitest";
import { plainText } from "./text";

const p = (...text: string[]) => ({ type: "paragraph", content: text.map((t) => ({ type: "text", text: t })) });

describe("plainText", () => {
  it("joins paragraphs with a space", () => {
    expect(plainText({ type: "doc", content: [p("The road ran white."), p("Nobody ", "spoke.")] })).toBe(
      "The road ran white. Nobody spoke."
    );
  });

  it("reads nested blocks and hard breaks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "one" }, { type: "hardBreak" }, { type: "text", text: "two" }],
            },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [p("three")] }] },
      ],
    };
    expect(plainText(doc)).toBe("one two three");
  });

  it("collapses whitespace and skips empty paragraphs", () => {
    expect(plainText({ type: "doc", content: [p("  a  "), { type: "paragraph" }, p("b ")] })).toBe("a b");
  });

  it("is empty for no document", () => {
    expect(plainText(null)).toBe("");
  });
});
