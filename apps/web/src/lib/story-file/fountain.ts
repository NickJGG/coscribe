/**
 * A Script as Fountain (fountain.io), one line per Script Element with blank lines between, except a Character's
 * Parentheticals and Dialogue, which follow it directly. Where Fountain would read a line as another element it's
 * forced (`.` Scene Heading, `@` Character, `> ` Transition, `!` Action), so every element round-trips. Bold and
 * italic are Fountain's `**` and `*`; Fountain has no strikethrough, so it's written as Markdown's `~~`. Empty lines
 * are left out, and a Parenthetical or Dialogue that doesn't follow a Character comes back as Action.
 */
import type { JSONContent } from "@tiptap/core";
import type { ScriptElementType } from "@coscribe/editor";
import MarkdownIt from "markdown-it";
import { readInline, writeInline } from "./inline";

const inlineParser = new MarkdownIt("zero").enable(["emphasis", "strikethrough", "escape"]);

const escapeFountain = (text: string) => text.replace(/[\\*_~]/g, "\\$&");

const SCENE_HEADING = /^(int|ext|est|int\.?\/ext|i\/e)[. ]/i;

const FORCE: Partial<Record<ScriptElementType, string>> = {
  sceneHeading: ".",
  character: "@",
  transition: "> ",
  action: "!",
};

const SPEAKING = new Set<string>(["character", "parenthetical", "dialogue"]);

const isUpper = (text: string) => /\p{L}/u.test(text) && text === text.toUpperCase();

/** How Fountain reads `line`: inside a Character's block, or standing alone with (`followed`) or without a line below. */
function readLine(line: string, inDialogue: boolean, followed: boolean): { element: ScriptElementType; text: string } {
  if (inDialogue) return { element: /^\(.*\)$/.test(line) ? "parenthetical" : "dialogue", text: line };
  if (line.startsWith("!")) return { element: "action", text: line.slice(1) };
  if (line.startsWith("@")) return { element: "character", text: line.slice(1) };
  if (/^\.[^.]/.test(line)) return { element: "sceneHeading", text: line.slice(1) };
  if (line.startsWith(">") && !line.endsWith("<")) return { element: "transition", text: line.slice(1).trimStart() };
  if (SCENE_HEADING.test(line)) return { element: "sceneHeading", text: line };
  if (followed && isUpper(line.replace(/\(.*?\)/g, ""))) return { element: "character", text: line };
  if (isUpper(line) && line.endsWith("TO:")) return { element: "transition", text: line };
  return { element: "action", text: line };
}

export function scriptToFountain(script: JSONContent): string {
  const lines = (script.content ?? [])
    .map((node) => ({
      element: (node.attrs?.element ?? "action") as ScriptElementType,
      text: writeInline(node.content, escapeFountain).trim(),
    }))
    .filter((line) => line.text);

  const joined = lines.map(() => false);
  lines.forEach((line, i) => {
    const prev = lines[i - 1];
    joined[i] = !!prev && (line.element === "parenthetical" || line.element === "dialogue") &&
      (prev.element === "character" || joined[i - 1]!);
  });

  return lines
    .map((line, i) => {
      const read = readLine(line.text, joined[i]!, !!joined[i + 1]);
      const natural = read.element === line.element && read.text === line.text;
      const text = natural ? line.text : (FORCE[line.element] ?? "") + line.text;
      return (i === 0 ? "" : joined[i] ? "\n" : "\n\n") + text;
    })
    .join("");
}

/** A `script` node, or null when the text has no lines. */
export function fountainToScript(fountain: string): JSONContent | null {
  const lines = fountain.split(/\r\n?|\n/).map((line) => line.trim());
  const content: JSONContent[] = [];
  let inDialogue = false;
  lines.forEach((line, i) => {
    if (!line) {
      inDialogue = false;
      return;
    }
    const { element, text } = readLine(line, inDialogue, !!lines[i + 1]);
    inDialogue = SPEAKING.has(element);
    const inline = readInline(inlineParser.parseInline(text, {})[0]?.children ?? null);
    content.push({ type: "scriptElement", attrs: { element }, ...(inline.length ? { content: inline } : {}) });
  });
  return content.length ? { type: "script", content } : null;
}
