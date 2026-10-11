import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { RibbonSegment } from "@/components/ContributionRibbon";
import { formerWriterNames } from "@/lib/story";
import { readAuthorChars, storyRibbon } from "./contribution";

export type StoryCardDetails = { chapterCount: number; words: number; ribbon: RibbonSegment[] };

export const NO_DETAILS: StoryCardDetails = { chapterCount: 0, words: 0, ribbon: [] };

/** What a StoryCard needs beyond the list RPCs' rows, keyed by Story id. */
export async function storyCardDetails(
  supabase: SupabaseClient<Database>,
  ids: string[]
): Promise<Map<string, StoryCardDetails>> {
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("stories")
    .select(`
      id,
      chapters (word_count, author_chars),
      members:story_members (role, joined_at, author_color, profile:profiles (id, username, author_color))
    `)
    .in("id", ids);

  const stories = (data ?? []).map((story) => ({
    id: story.id,
    members: story.members.map((m) => ({
      id: m.profile.id,
      name: m.profile.username,
      color: m.author_color ?? m.profile.author_color,
      role: m.role,
      joinedAt: m.joined_at,
    })),
    chapterCount: story.chapters.length,
    words: story.chapters.reduce((sum, c) => sum + c.word_count, 0),
    chars: story.chapters.map((c) => readAuthorChars(c.author_chars)),
  }));

  const formerNames = await formerWriterNames(
    stories.flatMap((s) => {
      const memberIds = new Set(s.members.map((m) => m.id));
      return s.chars.flatMap(Object.keys).filter((id) => !memberIds.has(id));
    }),
    supabase
  );

  return new Map(
    stories.map((s) => [
      s.id,
      { chapterCount: s.chapterCount, words: s.words, ribbon: storyRibbon(s.members, s.chars, formerNames) },
    ])
  );
}
