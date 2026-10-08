import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { isUuid } from "@/lib/action-result";
import type { MemberRole } from "@/lib/story-roles";
import type { StoryAuthor, Writer } from "@/components/LiveDocument";

const ROLE_ORDER: Record<MemberRole, number> = { host: 0, cohost: 1, writer: 2 };

/**
 * A Story the viewer may see (null otherwise), its members Host-first, and the viewer's own role. Each
 * member's `profile.author_color` is their effective color in this Story; `story_color` is set only when
 * that differs from their profile color.
 */
export const getStory = cache(async (storyId: string) => {
  if (!isUuid(storyId)) return null;
  const supabase = await createClient();

  const { data: story } = await supabase
    .from("stories")
    .select("id, title, blurb, visibility, status, created_at, finished_at")
    .eq("id", storyId)
    .maybeSingle();
  if (!story) return null;

  const [{ data: members }, viewer] = await Promise.all([
    supabase
      .from("story_members")
      .select("role, joined_at, story_color:author_color, profile:profiles (id, username, author_color)")
      .eq("story_id", storyId),
    getViewer(),
  ]);

  const sorted = (members ?? [])
    .map((m) => ({ ...m, profile: { ...m.profile, author_color: m.story_color ?? m.profile.author_color } }))
    .sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.profile.username.localeCompare(b.profile.username)
  );
  const myRole = sorted.find((m) => m.profile.id === viewer?.userId)?.role ?? null;

  return { story, members: sorted, myRole, viewer };
});

/** A visible Story's Chapters in reading order (empty if the viewer can't see the story). */
export const getChapters = cache(async (storyId: string) => {
  if (!isUuid(storyId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, title, position, locked, word_count, edited_at")
    .eq("story_id", storyId)
    .order("position");
  return data ?? [];
});

/** The Story Bible, alphabetical (empty if the viewer can't see the story). */
export const getEntries = cache(async (storyId: string) => {
  if (!isUuid(storyId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("id, type, name, description, aliases, link_mentions")
    .eq("story_id", storyId)
    .order("name");
  return data ?? [];
});

/** How the viewer shows up in a live document: a named caret for members, nothing for Viewers. */
export function liveWriter({
  members,
  viewer,
}: {
  members: { profile: { id: string; username: string; author_color: string } }[];
  viewer: Awaited<ReturnType<typeof getViewer>>;
}): Writer | null {
  const me = members.find((m) => m.profile.id === viewer?.userId);
  return me ? { userId: me.profile.id, name: me.profile.username, color: me.profile.author_color } : null;
}

/** Members' names and Author Colors, for tinting and labelling `author` marks. */
export function storyAuthors({
  members,
}: {
  members: { profile: { id: string; username: string; author_color: string } }[];
}): StoryAuthor[] {
  return members.map(({ profile }) => ({ id: profile.id, name: profile.username, color: profile.author_color }));
}

/** Usernames of former Writers whose text survives. Deleted accounts are simply missing. */
export async function formerWriterNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, username").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((p) => [p.id, p.username]));
}
