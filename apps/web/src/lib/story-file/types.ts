import type { JSONContent } from "@tiptap/core";
import type { EntryType } from "../entries";

/** A Story as Export writes it and Import reads it, independent of any one file format. */
export type StoryFile = {
  title: string;
  blurb: string;
  status: "finished" | "draft";
  /** `YYYY-MM-DD`, or empty for a file from elsewhere. */
  exported: string;
  chapters: ChapterFile[];
  entries: EntryFile[];
  credits?: CreditFile[];
  /** Export only, for the title page: who wrote it, most first, and the Finished date (`YYYY-MM-DD`). */
  byline?: string[];
  finished?: string;
};

export type ChapterFile = { title: string; content: JSONContent; outline?: OutlineFile };

/** An Outline's non-empty fields by label, defaults first, and its Characters by Entry name. */
export type OutlineFile = { fields: { label: string; content: JSONContent }[]; characters: string[] };

export type EntryFile = { type: EntryType; name: string; description: string; aliases: string[]; body: JSONContent };

/** `share` is the fraction (0–1) of the Story's credited text. `role` is empty for Imported Text. */
export type CreditFile = { name: string; role: string; share: number };
