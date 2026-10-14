import type { JSONContent } from "@tiptap/core";

const ENTITY: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export const escapeXml = (text: string) => text.replace(/[&<>"]/g, (c) => ENTITY[c]!);

/** Chapter, Entry or Outline JSON as XHTML, with ProseView's elements and attributes. Authorship and Notes are left out. */
export function toXhtml(doc: JSONContent): string {
  return (doc.content ?? []).map(node).join("\n");
}

function children(parent: JSONContent): string {
  return (parent.content ?? []).map(node).join("");
}

function node(n: JSONContent): string {
  switch (n.type) {
    case "paragraph": {
      const align = n.attrs?.textAlign;
      const style = align === "center" || align === "right" ? ` style="text-align: ${align}"` : "";
      return `<p${style}>${children(n)}</p>`;
    }
    case "blockquote":
      return `<blockquote>${children(n)}</blockquote>`;
    case "script":
      return `<div data-script="">${children(n)}</div>`;
    case "scriptElement":
      return `<p data-element="${escapeXml(String(n.attrs?.element ?? "action"))}">${children(n)}</p>`;
    case "sceneBreak":
      return `<hr data-scene-break="" />`;
    case "hardBreak":
      return "<br />";
    case "bulletList":
      return `<ul>${children(n)}</ul>`;
    case "orderedList": {
      const start = typeof n.attrs?.start === "number" ? ` start="${n.attrs.start}"` : "";
      return `<ol${start}>${children(n)}</ol>`;
    }
    case "listItem":
      return `<li>${children(n)}</li>`;
    case "text": {
      let out = escapeXml(n.text ?? "");
      for (const mark of n.marks ?? []) {
        if (mark.type === "bold") out = `<strong>${out}</strong>`;
        else if (mark.type === "italic") out = `<em>${out}</em>`;
        else if (mark.type === "strike") out = `<s>${out}</s>`;
      }
      return out;
    }
    default:
      return children(n);
  }
}
