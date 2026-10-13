import type { JSONContent } from "@tiptap/core";
import { blockTexts } from "@coscribe/editor";
import { ENTRY_TYPES, type EntryType } from "../entries";
import type { StoryFile } from "./types";

/** What Import would make of a file, shown before importing it. */
export type StorySummary = {
  chapters: number;
  words: number;
  entries: { type: EntryType; count: number }[];
  outlines: number;
  scripts: number;
  firstChapters: string[];
};

export function summarize(file: StoryFile): StorySummary {
  const words = file.chapters.reduce(
    (sum, c) => sum + (blockTexts(c.content).join("\n").match(/\S+/gu)?.length ?? 0),
    0
  );
  return {
    chapters: file.chapters.length,
    words,
    entries: ENTRY_TYPES.map((type) => ({ type, count: file.entries.filter((e) => e.type === type).length })).filter(
      (group) => group.count
    ),
    outlines: file.chapters.filter((c) => c.outline).length,
    scripts: file.chapters.reduce((sum, c) => sum + countScripts(c.content), 0),
    firstChapters: file.chapters.slice(0, 3).map((c) => c.title),
  };
}

function countScripts(node: JSONContent): number {
  return node.type === "script" ? 1 : (node.content ?? []).reduce((sum, child) => sum + countScripts(child), 0);
}
