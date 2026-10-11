import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { MemberRole } from "@/lib/story-roles";
import type { RibbonSegment } from "@/components/ContributionRibbon";
import { byJoinOrder, readAuthorChars, storyRibbon } from "./contribution";

/** The profile User's memberships in every Story the caller can read (RLS on story_members filters). */
export function profileStoryRows(supabase: SupabaseClient<Database>, profileId: string) {
  return supabase
    .from("story_members")
    .select(`
      role,
      story:stories!inner (
        id, title, blurb, status, visibility, created_at, finished_at,
        chapters (word_count, author_chars, edited_at),
        members:story_members (role, joined_at, author_color, profile:profiles (id, username, author_color)),
        activity:story_activity (writers, viewers)
      )
    `)
    .eq("user_id", profileId);
}

export type ProfileStoryRow = NonNullable<Awaited<ReturnType<typeof profileStoryRows>>["data"]>[number];

export type ProfileStory = {
  id: string;
  title: string;
  blurb: string | null;
  status: Database["public"]["Enums"]["story_status"];
  visibility: Database["public"]["Enums"]["story_visibility"];
  /** The profile User's role. */
  role: MemberRole;
  chapterCount: number;
  words: number;
  createdAt: string;
  finishedAt: string | null;
  editedAt: string | null;
  writers: number;
  viewers: number;
  ribbon: RibbonSegment[];
};

/** Ids in the Stories' author counts that aren't current members, for formerWriterNames. */
export function formerWriterIds(rows: ProfileStoryRow[]): string[] {
  return rows.flatMap(({ story }) => {
    const memberIds = new Set(story.members.map((m) => m.profile.id));
    return story.chapters.flatMap((c) => Object.keys(readAuthorChars(c.author_chars))).filter((id) => !memberIds.has(id));
  });
}

function toProfileStory({ role, story }: ProfileStoryRow, formerNames: ReadonlyMap<string, string>): ProfileStory {
  const members = story.members
    .map((m) => ({
      id: m.profile.id,
      name: m.profile.username,
      color: m.author_color ?? m.profile.author_color,
      role: m.role,
      joinedAt: m.joined_at,
    }))
    .sort(byJoinOrder);
  const editedAt = story.chapters.reduce<string | null>(
    (latest, c) => (c.edited_at && (!latest || c.edited_at > latest) ? c.edited_at : latest),
    null
  );
  return {
    id: story.id,
    title: story.title,
    blurb: story.blurb,
    status: story.status,
    visibility: story.visibility,
    role,
    chapterCount: story.chapters.length,
    words: story.chapters.reduce((sum, c) => sum + c.word_count, 0),
    createdAt: story.created_at,
    finishedAt: story.finished_at,
    editedAt,
    writers: story.activity?.writers ?? 0,
    viewers: story.activity?.viewers ?? 0,
    ribbon: storyRibbon(
      members,
      story.chapters.map((c) => readAuthorChars(c.author_chars)),
      formerNames
    ),
  };
}

/** Finished first (latest first), then latest edited, then Stories with no words yet (newest first). */
function byProfileOrder(a: ProfileStory, b: ProfileStory): number {
  const rank = (s: ProfileStory) => (s.status === "finished" ? 0 : s.words > 0 ? 1 : 2);
  const key = (s: ProfileStory) => (s.status === "finished" ? s.finishedAt : s.words > 0 ? s.editedAt : s.createdAt) ?? "";
  return rank(a) - rank(b) || key(b).localeCompare(key(a));
}

/**
 * The profile's Stories, each in one section: Writing together holds the ones the viewer is also a
 * member of (never on your own profile); the rest split into Finished and Being written.
 */
export function profileStories(
  rows: ProfileStoryRow[],
  profileId: string,
  viewerId: string | null,
  formerNames: ReadonlyMap<string, string>
): { together: ProfileStory[]; finished: ProfileStory[]; writing: ProfileStory[] } {
  const together: ProfileStory[] = [];
  const finished: ProfileStory[] = [];
  const writing: ProfileStory[] = [];
  for (const row of rows) {
    const story = toProfileStory(row, formerNames);
    const shared = viewerId !== null && viewerId !== profileId && row.story.members.some((m) => m.profile.id === viewerId);
    (shared ? together : story.status === "finished" ? finished : writing).push(story);
  }
  return {
    together: together.sort(byProfileOrder),
    finished: finished.sort(byProfileOrder),
    writing: writing.sort(byProfileOrder),
  };
}

export type CoWriter = { id: string; username: string; color: string; shared: number };

/** Everyone the profile User shares one of these Stories with, most shared Stories first. */
export function writesWith(rows: ProfileStoryRow[], profileId: string): CoWriter[] {
  const byId = new Map<string, CoWriter>();
  for (const { story } of rows) {
    for (const { profile } of story.members) {
      if (profile.id === profileId) continue;
      const entry = byId.get(profile.id);
      if (entry) entry.shared++;
      else byId.set(profile.id, { id: profile.id, username: profile.username, color: profile.author_color, shared: 1 });
    }
  }
  return [...byId.values()].sort((a, b) => b.shared - a.shared || a.username.localeCompare(b.username));
}
