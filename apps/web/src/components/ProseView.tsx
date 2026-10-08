import type { JSONContent } from "@tiptap/core";

/**
 * Renders stored Chapter or Entry JSON as plain markup, server-side, matching the editor's output
 * (`span[data-author]` runs, `hr[data-scene-break]`) so LiveDocument's prose and authorship styles apply.
 */
export function ProseView({ content }: { content: JSONContent }) {
  return <Children nodes={content.content} />;
}

function Children({ nodes }: { nodes: JSONContent[] | undefined }) {
  return nodes?.map((node, i) => <Node key={i} node={node} />);
}

function Node({ node }: { node: JSONContent }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p>
          <Children nodes={node.content} />
        </p>
      );
    case "sceneBreak":
      return <hr data-scene-break="" />;
    case "bulletList":
      return (
        <ul>
          <Children nodes={node.content} />
        </ul>
      );
    case "orderedList":
      return (
        <ol start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined}>
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

/** A text node wrapped in its marks, as the editor renders them. */
export function Text({ node }: { node: JSONContent }) {
  let out: React.ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
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
