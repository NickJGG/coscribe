import type { JSONContent } from "@tiptap/core";
import type { AuthorAttrs } from "@coscribe/editor";
import type { ChapterFile, EntryFile, StoryFile } from "./types";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_CHAPTERS = 500;

/**
 * A parsed file as Import sends it to sync: every run of text credited to `author`, and names cut to what the
 * tables take (a Chapter with no title gets its number, an Entry with no name is left out).
 */
export function importContent(file: StoryFile, author: AuthorAttrs): Pick<StoryFile, "chapters" | "entries"> {
  const stamp = (node: JSONContent) => stampAuthor(node, author);
  return {
    chapters: file.chapters.map(
      (chapter, i): ChapterFile => ({
        title: cut(chapter.title, 120) || `Chapter ${i + 1}`,
        content: stamp(chapter.content),
        ...(chapter.outline && {
          outline: {
            fields: chapter.outline.fields.flatMap(({ label, content }) =>
              cut(label, 120) ? [{ label: cut(label, 120), content: stamp(content) }] : []
            ),
            characters: chapter.outline.characters.map((name) => cut(name, 80)).filter(Boolean),
          },
        }),
      })
    ),
    entries: file.entries.flatMap((entry): EntryFile[] =>
      cut(entry.name, 80)
        ? [
            {
              type: entry.type,
              name: cut(entry.name, 80),
              description: cut(entry.description, 280),
              aliases: [...new Set(entry.aliases.map((alias) => cut(alias, 80)).filter(Boolean))].slice(0, 20),
              body: stamp(entry.body),
            },
          ]
        : []
    ),
  };
}

function cut(text: string, max: number): string {
  return [...text.trim()].slice(0, max).join("").trim();
}

/** Replaces any `author` mark on every text node with `author`. */
export function stampAuthor(node: JSONContent, author: AuthorAttrs): JSONContent {
  if (node.type === "text") {
    return { ...node, marks: [...(node.marks ?? []).filter((m) => m.type !== "author"), { type: "author", attrs: author }] };
  }
  return node.content ? { ...node, content: node.content.map((child) => stampAuthor(child, author)) } : node;
}
