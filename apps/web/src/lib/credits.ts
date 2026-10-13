import { countAuthorCharacters, IMPORTED_AUTHOR } from "@coscribe/editor";
import type { StoryContent } from "./sync";

export type Tally = { chapters: Map<string, number>; bible: Map<string, number> };

type Person = { id: string; username: string; author_color: string };

/** One Credits line. `person` is null for a deleted account, and for Imported Text (`id` is `IMPORTED_AUTHOR`). */
export type Credit = { id: string; person: Person | null; chapters: number; bible: number };

/** Characters per author across the story's Chapters, and separately across its Story Bible. */
export function tallyAuthors(content: StoryContent): Tally {
  const chapters = new Map<string, number>();
  const bible = new Map<string, number>();
  for (const doc of Object.values(content.chapter)) countAuthorCharacters(doc, chapters);
  for (const doc of Object.values(content.entry)) countAuthorCharacters(doc, bible);
  return { chapters, bible };
}

/** Every account with surviving text, leaving out Imported Text. */
export function authorIds({ chapters, bible }: Tally): string[] {
  return [...new Set([...chapters.keys(), ...bible.keys()])].filter((id) => id !== IMPORTED_AUTHOR);
}

/**
 * Every current Writer (even with nothing written) and anyone else whose text survives (former Writers, and
 * Writers since made Viewers), plus a line for any Imported Text, most Chapter text first.
 */
export function creditLines(tally: Tally, writerIds: string[], people: Person[]): Credit[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const imported = tally.chapters.has(IMPORTED_AUTHOR) || tally.bible.has(IMPORTED_AUTHOR) ? [IMPORTED_AUTHOR] : [];
  return [...new Set([...writerIds, ...authorIds(tally), ...imported])]
    .map((id) => ({
      id,
      person: byId.get(id) ?? null,
      chapters: tally.chapters.get(id) ?? 0,
      bible: tally.bible.get(id) ?? 0,
    }))
    .sort(
      (a, b) =>
        b.chapters - a.chapters ||
        b.bible - a.bible ||
        (a.person?.username ?? "~").localeCompare(b.person?.username ?? "~")
    );
}
