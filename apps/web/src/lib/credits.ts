import { countAuthorCharacters } from "@coscribe/editor";
import type { StoryContent } from "./sync";

export type Tally = { chapters: Map<string, number>; bible: Map<string, number> };

type Person = { id: string; username: string; author_color: string };

/** One Credits line. `person` is null for a deleted account. */
export type Credit = { id: string; person: Person | null; chapters: number; bible: number };

/** Characters per author across the story's Chapters, and separately across its Story Bible. */
export function tallyAuthors(content: StoryContent): Tally {
  const chapters = new Map<string, number>();
  const bible = new Map<string, number>();
  for (const doc of Object.values(content.chapter)) countAuthorCharacters(doc, chapters);
  for (const doc of Object.values(content.entry)) countAuthorCharacters(doc, bible);
  return { chapters, bible };
}

export function authorIds({ chapters, bible }: Tally): string[] {
  return [...new Set([...chapters.keys(), ...bible.keys()])];
}

/**
 * Every current member (even with nothing written) and every former Writer whose text survives, most
 * Chapter text first.
 */
export function creditLines(tally: Tally, memberIds: string[], people: Person[]): Credit[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  return [...new Set([...memberIds, ...authorIds(tally)])]
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
