import type { JSONContent } from "@tiptap/core";
import type { Token } from "markdown-it";

/** Bold, italic and strikethrough as `**`, `*` and `~~`, shared by Markdown and Fountain. Other marks aren't written. */
type Style = "bold" | "italic" | "strike";

const STYLES: Style[] = ["bold", "italic", "strike"];

const DELIMITER: Record<Style, string> = { bold: "**", italic: "*", strike: "~~" };

const sameStyles = (a: Style[], b: Style[]) => a.length === b.length && a.every((s, i) => s === b[i]);

/** A line break is written as a bare `\n`, outside any delimiters, for the caller to write as it needs. */
export function writeInline(nodes: JSONContent[] | undefined, escape: (text: string) => string): string {
  const runs: { text: string; styles: Style[] }[] = [];
  for (const node of nodes ?? []) {
    const text = node.type === "hardBreak" ? "\n" : node.text;
    if (!text) continue;
    // `** **` isn't emphasis, and styled whitespace looks the same unstyled.
    const styles = /\S/.test(text) ? STYLES.filter((s) => node.marks?.some((m) => m.type === s)) : [];
    const last = runs.at(-1);
    if (last && sameStyles(last.styles, styles)) last.text += text;
    else runs.push({ text, styles });
  }

  let out = "";
  let open: Style[] = [];
  // Delimiters can't sit against whitespace on their inner side, so it moves outside them.
  const close = (keep: number) => {
    if (keep >= open.length) return;
    const trailing = /\s*$/.exec(out)![0];
    out = out.slice(0, out.length - trailing.length);
    for (let i = open.length - 1; i >= keep; i--) out += DELIMITER[open[i]!];
    out += trailing;
    open = open.slice(0, keep);
  };
  for (const run of runs) {
    const stale = open.findIndex((s) => !run.styles.includes(s));
    close(stale < 0 ? open.length : stale);
    let text = escape(run.text);
    const opening = run.styles.filter((s) => !open.includes(s));
    if (opening.length) {
      const leading = /^\s*/.exec(text)![0];
      out += leading;
      text = text.slice(leading.length);
      for (const style of opening) {
        out += DELIMITER[style];
        open.push(style);
      }
    }
    out += text;
  }
  close(0);
  return out;
}

/**
 * Text nodes from markdown-it inline tokens. Links keep their text; images and inline HTML are left out. Hard
 * breaks are spaces, or line breaks with `breaks`.
 */
export function readInline(tokens: Token[] | null, { breaks = false } = {}): JSONContent[] {
  const depth: Record<Style, number> = { bold: 0, italic: 0, strike: 0 };
  const out: JSONContent[] = [];
  const push = (text: string) => {
    if (!text) return;
    const styles = STYLES.filter((s) => depth[s] > 0);
    const last = out.at(-1)?.type === "text" ? out.at(-1) : undefined;
    const lastStyles = (last?.marks ?? []).map((m) => m.type as Style);
    if (last && sameStyles(lastStyles, styles)) last.text += text;
    else out.push(styles.length ? { type: "text", text, marks: styles.map((type) => ({ type })) } : { type: "text", text });
  };
  for (const token of tokens ?? []) {
    switch (token.type) {
      case "strong_open":
      case "strong_close":
        depth.bold += token.nesting;
        break;
      case "em_open":
      case "em_close":
        depth.italic += token.nesting;
        break;
      case "s_open":
      case "s_close":
        depth.strike += token.nesting;
        break;
      case "text":
      case "code_inline":
        push(token.content);
        break;
      case "hardbreak":
        if (breaks) out.push({ type: "hardBreak" });
        else push(" ");
        break;
      case "softbreak":
        push(" ");
        break;
    }
  }
  return out;
}

export function plainText(tokens: Token[] | null): string {
  return readInline(tokens)
    .map((node) => node.text)
    .join("")
    .trim();
}
