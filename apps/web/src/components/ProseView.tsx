import type { JSONContent } from "@tiptap/core";

/**
 * Renders stored Chapter or Entry JSON as plain markup, server-side, matching the editor's output
 * (`span[data-author]` runs, `hr[data-scene-break]`, `p` with `text-align`, `div[data-script]` of `p[data-element]`)
 * so LiveDocument's prose, Script and authorship styles apply. `positions` numbers the top-level blocks with
 * `data-block` (a block quote or Script, not its lines), for mapping a selection back to the JSON.
 */
export function ProseView({ content, positions = false }: { content: JSONContent; positions?: boolean }) {
  return content.content?.map((node, i) => <Node key={i} node={node} block={positions ? i : undefined} />);
}

function Children({ nodes }: { nodes: JSONContent[] | undefined }) {
  return nodes?.map((node, i) => <Node key={i} node={node} />);
}

function Node({ node, block }: { node: JSONContent; block?: number }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p data-block={block} style={alignStyle(node)}>
          <Children nodes={node.content} />
        </p>
      );
    case "blockquote":
      return (
        <blockquote data-block={block}>
          <Children nodes={node.content} />
        </blockquote>
      );
    case "script":
      return (
        <div data-script="" data-block={block}>
          <Children nodes={node.content} />
        </div>
      );
    case "scriptElement":
      return (
        <p data-element={node.attrs?.element ?? "action"}>
          <Children nodes={node.content} />
        </p>
      );
    case "sceneBreak":
      return <hr data-scene-break="" data-block={block} />;
    case "bulletList":
      return (
        <ul data-block={block}>
          <Children nodes={node.content} />
        </ul>
      );
    case "orderedList":
      return (
        <ol start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined} data-block={block}>
          <Children nodes={node.content} />
        </ol>
      );
    case "listItem":
      return (
        <li>
          <Children nodes={node.content} />
        </li>
      );
    case "text":
      return <Text node={node} />;
    default:
      return <Children nodes={node.content} />;
  }
}

export function alignStyle(node: JSONContent): React.CSSProperties | undefined {
  const align = node.attrs?.textAlign;
  return align === "center" || align === "right" ? { textAlign: align } : undefined;
}

/** A text node wrapped in its marks, as the editor renders them. */
export function Text({ node }: { node: JSONContent }) {
  let out: React.ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "strike") out = <s>{out}</s>;
    else if (mark.type === "author") {
      out = (
        <span data-author={mark.attrs?.userId} data-at={mark.attrs?.at}>
          {out}
        </span>
      );
    }
  }
  return out;
}
