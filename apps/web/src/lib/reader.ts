import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChapters, getEntries, getStory } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { fetchStoryContent } from "@/lib/sync";
import { authorIds, creditLines, tallyAuthors } from "@/lib/credits";
import type { StoryAuthor } from "@/components/LiveDocument";

/**
 * A Finished story for the Reader View: its Chapters, Story Bible, every body's text (null if the sync
 * server is down), and Credits. Former Writers whose text survives get their names and colors too.
 */
export const getReader = cache(async (storyId: string) => {
  const data = await getStory(storyId);
  if (!data || data.story.status !== "finished") return data && { ...data, finished: false as const };

  const [chapters, entries, content] = await Promise.all([
    getChapters(storyId),
    getEntries(storyId),
    fetchStoryContent(storyId),
  ]);
  const tally = content && tallyAuthors(content);
  const people = await withFormerWriters(
    data.members.map((m) => m.profile),
    tally ? authorIds(tally) : []
  );
  const credits = tally && creditLines(tally, data.members.map((m) => m.profile.id), people);
  const authors: StoryAuthor[] = people.map((p) => ({ id: p.id, name: p.username, color: p.author_color }));

  return { ...data, finished: true as const, chapters, entries, content, credits, authors };
});

async function withFormerWriters(people: { id: string; username: string; author_color: string }[], authors: string[]) {
  const known = new Set(people.map((p) => p.id));
  const former = authors.filter((id) => !known.has(id));
  if (!former.length) return people;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, username, author_color").in("id", former);
  return [...people, ...(data ?? [])];
}

/** Not-yet-Finished stories go back to the story page. */
export async function requireReader(storyId: string, here: string) {
  const data = await getReader(storyId);
  if (!data) {
    if (!(await getViewer())) redirect(`/login?next=${encodeURIComponent(here)}`);
    notFound();
  }
  if (!data.finished) redirect(`/stories/${storyId}`);
  return data;
}
