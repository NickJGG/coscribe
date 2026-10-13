import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { fountainToScript, scriptToFountain } from "./fountain";

const line = (element: string, text: string): JSONContent => ({
  type: "scriptElement",
  attrs: { element },
  content: [{ type: "text", text }],
});

const script = (...content: JSONContent[]): JSONContent => ({ type: "script", content });

const roundTrip = (s: JSONContent) => fountainToScript(scriptToFountain(s));

describe("scriptToFountain", () => {
  it("writes a plain scene as Fountain readers expect it", () => {
    const s = script(
      line("sceneHeading", "INT. MILL - NIGHT"),
      line("action", "Rain hammers the roof."),
      line("character", "ANNA"),
      line("parenthetical", "(whispering)"),
      line("dialogue", "Is anyone there?"),
      line("transition", "CUT TO:")
    );
    expect(scriptToFountain(s)).toBe(
      "INT. MILL - NIGHT\n\nRain hammers the roof.\n\nANNA\n(whispering)\nIs anyone there?\n\nCUT TO:"
    );
    expect(roundTrip(s)).toEqual(s);
  });

  it("forces elements Fountain would read as something else", () => {
    const s = script(
      line("sceneHeading", "The mill, later"),
      line("action", "INT. looks like a heading"),
      line("action", "FADE TO:"),
      line("action", "> quoted"),
      line("action", "!bang"),
      line("character", "Anna"),
      line("dialogue", "Hi."),
      line("character", "BOB"),
      line("transition", "Smash cut.")
    );
    expect(scriptToFountain(s)).toBe(
      ".The mill, later\n\n!INT. looks like a heading\n\n!FADE TO:\n\n!> quoted\n\n!!bang\n\n@Anna\nHi.\n\n@BOB\n\n> Smash cut."
    );
    expect(roundTrip(s)).toEqual(s);
  });

  it("keeps several Parentheticals and Dialogue lines under one Character", () => {
    const s = script(
      line("character", "ANNA (V.O.)"),
      line("dialogue", "First."),
      line("parenthetical", "(beat)"),
      line("dialogue", "Second."),
      line("dialogue", "Third.")
    );
    expect(roundTrip(s)).toEqual(s);
  });

  it("writes bold, italic and strikethrough, escaping literal markers", () => {
    const marked = script(
      {
        type: "scriptElement",
        attrs: { element: "action" },
        content: [
          { type: "text", text: "She " },
          { type: "text", text: "runs", marks: [{ type: "bold" }] },
          { type: "text", text: " and " },
          { type: "text", text: "hides", marks: [{ type: "italic" }] },
          { type: "text", text: " or " },
          { type: "text", text: "not", marks: [{ type: "strike" }] },
          { type: "text", text: "." },
        ],
      },
      line("action", "*stars* and_under~tilde\\")
    );
    expect(scriptToFountain(marked)).toBe("She **runs** and *hides* or ~~not~~.\n\n\\*stars\\* and\\_under\\~tilde\\\\");
    expect(roundTrip(marked)).toEqual(marked);
  });

  it("leaves out empty lines", () => {
    expect(scriptToFountain(script({ type: "scriptElement", attrs: { element: "action" } }, line("action", "Go.")))).toBe("Go.");
    expect(fountainToScript("\n\n")).toBeNull();
  });

  it("reads orphaned Dialogue as Action", () => {
    expect(roundTrip(script(line("action", "Door."), line("dialogue", "Hello?")))).toEqual(
      script(line("action", "Door."), line("action", "Hello?"))
    );
  });
});
