import { findFolded, foldQuery, foldText, MIN_QUERY, type FindMatch, type FoldedText } from "@coscribe/editor";
import { ENTRY_TYPES, type EntryType } from "./entries";
import type { SearchText } from "./actions/search";

type IndexedBlock = { text: string; folded: FoldedText };

/** A Story's text folded once, so each keystroke only scans. Entries are in the sidebar's order. */
export type SearchIndex = {
  chapters: { id: string; title: string; blocks: IndexedBlock[] }[];
  entries: { id: string; type: EntryType; name: string; aliases: string[]; description: string; blocks: IndexedBlock[] }[];
};

export function indexStory(text: SearchText): SearchIndex {
  const index = (blocks: string[]) => blocks.map((t) => ({ text: t, folded: foldText(t) }));
  const typeOrder = (type: EntryType) => ENTRY_TYPES.indexOf(type);
  return {
    chapters: text.chapters.map((c) => ({ ...c, blocks: index(c.blocks) })),
    entries: [...text.entries]
      .sort((a, b) => typeOrder(a.type) - typeOrder(b.type) || a.name.localeCompare(b.name))
      .map((e) => ({ ...e, blocks: index(e.blocks) })),
  };
}

/** A match in context. `n` is its occurrence number in the document's body; null for a description. */
export type Snippet = { n: number | null; before: string; match: string; after: string };

export type ChapterResult = {
  id: string;
  number: number;
  title: string;
  titleMatches: FindMatch[];
  count: number;
  snippets: Snippet[];
};

export type EntryField = "name" | "Alias" | "description" | "body";

export type EntryResult = {
  id: string;
  type: EntryType;
  name: string;
  nameMatches: FindMatch[];
  fields: EntryField[];
  count: number;
  snippet: Snippet | null;
};

/** `total` counts body matches only: the stops the find bar steps through. */
export type SearchResults = { total: number; chapters: ChapterResult[]; entries: EntryResult[] };

const CONTEXT = 70;

export function snippet(text: string, { from, to }: FindMatch, n: number | null): Snippet {
  const start = Math.max(0, from - CONTEXT);
  const end = Math.min(text.length, to + CONTEXT);
  let before = text.slice(start, from);
  let after = text.slice(to, end);
  if (start > 0) before = `…${before.replace(/^\S*\s+/u, "")}`;
  if (end < text.length) after = `${after.replace(/\s+\S*$/u, "")}…`;
  return { n, before, match: text.slice(from, to), after };
}

function bodyMatches(blocks: IndexedBlock[], query: string): { text: string; match: FindMatch }[] {
  return blocks.flatMap(({ text, folded }) => findFolded(folded, query).map((match) => ({ text, match })));
}

/** Matches across the Story, or null when the query is too short to search. */
export function searchStory(index: SearchIndex, rawQuery: string): SearchResults | null {
  const query = foldQuery(rawQuery);
  if (query.length < MIN_QUERY) return null;
  const inText = (text: string) => findFolded(foldText(text), query);

  let total = 0;
  const chapters: ChapterResult[] = [];
  index.chapters.forEach((chapter, i) => {
    const body = bodyMatches(chapter.blocks, query);
    const titleMatches = inText(chapter.title);
    if (!body.length && !titleMatches.length) return;
    total += body.length;
    chapters.push({
      id: chapter.id,
      number: i + 1,
      title: chapter.title,
      titleMatches,
      count: body.length,
      snippets: body.map(({ text, match }, k) => snippet(text, match, k + 1)),
    });
  });

  const entries: EntryResult[] = [];
  for (const entry of index.entries) {
    const body = bodyMatches(entry.blocks, query);
    const nameMatches = inText(entry.name);
    const descriptionMatch = inText(entry.description)[0];
    const fields: EntryField[] = [];
    if (nameMatches.length) fields.push("name");
    if (entry.aliases.some((a) => inText(a).length)) fields.push("Alias");
    if (descriptionMatch) fields.push("description");
    if (body.length) fields.push("body");
    if (!fields.length) continue;
    total += body.length;
    entries.push({
      id: entry.id,
      type: entry.type,
      name: entry.name,
      nameMatches,
      fields,
      count: body.length,
      snippet: body[0]
        ? snippet(body[0].text, body[0].match, 1)
        : descriptionMatch
          ? snippet(entry.description, descriptionMatch, null)
          : null,
    });
  }

  return { total, chapters, entries };
}

export type DocumentCount = { kind: "chapter" | "entry"; id: string; count: number };

/** Body matches in every document, in Story order: Chapters, then Entries. */
export function countMatches(index: SearchIndex, rawQuery: string): DocumentCount[] {
  const query = foldQuery(rawQuery);
  const count = (blocks: IndexedBlock[]) => blocks.reduce((sum, b) => sum + findFolded(b.folded, query).length, 0);
  return [
    ...index.chapters.map((c) => ({ kind: "chapter" as const, id: c.id, count: count(c.blocks) })),
    ...index.entries.map((e) => ({ kind: "entry" as const, id: e.id, count: count(e.blocks) })),
  ];
}
