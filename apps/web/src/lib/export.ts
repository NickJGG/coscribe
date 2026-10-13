import { IMPORTED_AUTHOR } from "@coscribe/editor";
import { getChapters, getEntries, getStory } from "@/lib/story";
import { fetchStoryContent } from "@/lib/sync";
import { authorIds, creditLines, tallyAuthors } from "@/lib/credits";
import { entryGroups } from "@/lib/entries";
import { withFormerWriters } from "@/lib/reader";
import { isWriter, ROLE_LABEL } from "@/lib/story-roles";
import type { StoryFile } from "@/lib/story-file/types";

export type ExportOptions = { bible: boolean; outlines: boolean };

/**
 * The Story as a file, for anyone who can open its Reader View once it's Finished, and otherwise for its Writers (a
 * Draft Export). Outlines go only into a Draft Export. "unavailable" when the sync server can't be reached.
 */
export async function getExport(
  storyId: string,
  { bible, outlines }: ExportOptions
): Promise<StoryFile | "forbidden" | "unavailable"> {
  const data = await getStory(storyId);
  if (!data) return "forbidden";
  const { story, members } = data;
  const finished = story.status === "finished";
  if (!finished && !isWriter(data.myRole)) return "forbidden";

  const [chapters, entries, content] = await Promise.all([
    getChapters(storyId),
    getEntries(storyId),
    fetchStoryContent(storyId, { outlines: outlines && !finished }),
  ]);
  if (!content) return "unavailable";

  const tally = tallyAuthors(content);
  const people = await withFormerWriters(
    members.map((m) => m.profile),
    authorIds(tally)
  );
  const credits = creditLines(tally, members.map((m) => m.profile.id), people);
  const roles = new Map(members.map((m) => [m.profile.id, m.role]));
  const total = credits.reduce((sum, c) => sum + c.chapters, 0);
  const names = credits.flatMap((c) => (c.person && c.chapters + c.bible > 0 ? [c.person.username] : []));
  const entryNames = new Map(entries.map((e) => [e.id, e.name]));

  return {
    title: story.title,
    blurb: story.blurb ?? "",
    status: finished ? "finished" : "draft",
    exported: new Date().toISOString().slice(0, 10),
    finished: story.finished_at?.slice(0, 10),
    byline: names.length ? names : members.map((m) => m.profile.username),
    chapters: chapters.map((chapter) => {
      const outline = content.outline?.[chapter.id];
      return {
        title: chapter.title,
        content: content.chapter[chapter.id] ?? { type: "doc" },
        outline: outline && {
          fields: outline.fields.map(({ label, content }) => ({ label, content })),
          characters: outline.characters.flatMap((id) => entryNames.get(id) ?? []),
        },
      };
    }),
    entries: bible
      ? entryGroups(entries, story.entry_type_order).flatMap((group) =>
          group.entries.map((e) => ({
            type: e.type,
            name: e.name,
            description: e.description ?? "",
            aliases: e.aliases ?? [],
            body: content.entry[e.id] ?? { type: "doc" },
          }))
        )
      : [],
    credits: credits.map((c) => {
      const role = roles.get(c.id);
      if (c.id === IMPORTED_AUTHOR) return { name: "Imported text", role: "", share: total ? c.chapters / total : 0 };
      return {
        name: c.person?.username ?? "A deleted account",
        role: role ? ROLE_LABEL[role] : "Former Writer",
        share: total ? c.chapters / total : 0,
      };
    }),
  };
}
