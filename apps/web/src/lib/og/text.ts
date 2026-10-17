import type { JSONContent } from "@tiptap/core";

/** A document's text on one line: blocks joined with a space, hard breaks as spaces. */
export function plainText(doc: JSONContent | null | undefined): string {
  const blocks: string[] = [];
  let line = "";
  const walk = (node: JSONContent) => {
    if (node.type === "text") line += node.text ?? "";
    else if (node.type === "hardBreak") line += " ";
    else if (node.content?.some((c) => c.type === "text" || c.type === "hardBreak")) {
      for (const child of node.content) walk(child);
      blocks.push(line);
      line = "";
    } else node.content?.forEach(walk);
  };
  if (doc) walk(doc);
  return blocks.join(" ").replace(/\s+/g, " ").trim();
}
