"use server";

import { blockTexts, type ContentJSON } from "@coscribe/editor";
import { fetchStoryContent } from "@/lib/sync";
import { getChapters, getEntries, getStory } from "@/lib/story";
import { isUuid } from "@/lib/action-result";
import type { EntryType } from "@/lib/entries";

export type SearchText = {
  chapters: { id: string; title: string; blocks: string[] }[];
  entries: { id: string; type: EntryType; name: string; aliases: string[]; description: string; blocks: string[] }[];
};

type Bodies = { chapter: Record<string, string[]>; entry: Record<string, string[]> };

const FRESH_MS = 15_000;
const bodies = new Map<string, { at: number; text: Promise<Bodies | null> }>();

/**
 * Every Story's flattened text is shared by all its readers for a few seconds, so however many people
 * search (or one person hammers the action), apps/sync is asked at most once per window.
 */
function storyBodies(storyId: string): Promise<Bodies | null> {
  const now = Date.now();
  for (const [id, cached] of bodies) if (now - cached.at > FRESH_MS) bodies.delete(id);
  const cached = bodies.get(storyId);
  if (cached) return cached.text;

  const text = fetchStoryContent(storyId).then((content) => {
    if (!content) {
      bodies.delete(storyId);
      return null;
    }
    const flatten = (docs: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(docs).map(([id, doc]) => [id, blockTexts(doc as ContentJSON)]));
    return { chapter: flatten(content.chapter), entry: flatten(content.entry) };
  });
  bodies.set(storyId, { at: now, text });
  return text;
}

/** The searchable text of a Story the viewer may see: Chapters in order, then Entries. Null if it can't be had right now. */
export async function getSearchText(storyId: string): Promise<SearchText | null> {
  if (!isUuid(storyId) || !(await getStory(storyId))) return null;

  const [chapters, entries, text] = await Promise.all([getChapters(storyId), getEntries(storyId), storyBodies(storyId)]);
  if (!text) return null;
  return {
    chapters: chapters.map((c) => ({ id: c.id, title: c.title, blocks: text.chapter[c.id] ?? [] })),
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: e.aliases,
      description: e.description,
      blocks: text.entry[e.id] ?? [],
    })),
  };
}
