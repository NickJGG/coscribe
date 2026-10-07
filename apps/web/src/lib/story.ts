import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { isUuid } from "@/lib/action-result";
import type { MemberRole } from "@/lib/story-roles";
import type { StoryAuthor, Writer } from "@/components/LiveDocument";

const ROLE_ORDER: Record<MemberRole, number> = { host: 0, cohost: 1, writer: 2 };

/** A Story the viewer may see (null otherwise), its members Host-first, and the viewer's own role. */
export const getStory = cache(async (storyId: string) => {
  if (!isUuid(storyId)) return null;
  const supabase = await createClient();

  const { data: story } = await supabase
    .from("stories")
    .select("id, title, visibility, status, created_at")
    .eq("id", storyId)
    .maybeSingle();
  if (!story) return null;

  const [{ data: members }, viewer] = await Promise.all([
    supabase
      .from("story_members")
      .select("role, joined_at, profile:profiles (id, username, author_color)")
      .eq("story_id", storyId),
    getViewer(),
  ]);

  const sorted = (members ?? []).sort(
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
    .select("id, title, position, locked")
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
    .select("id, type, name, description")
    .eq("story_id", storyId)
    .order("name");
  return data ?? [];
});

export const getEntry = cache(async (storyId: string, entryId: string) => {
  if (!isUuid(storyId) || !isUuid(entryId)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("entries")
    .select("id, type, name, description")
    .eq("story_id", storyId)
    .eq("id", entryId)
    .maybeSingle();
  return data;
});

/** How the viewer shows up in a live document: a named caret for members, nothing for Viewers. */
export function liveWriter({
  myRole,
  viewer,
}: {
  myRole: MemberRole | null;
  viewer: Awaited<ReturnType<typeof getViewer>>;
}): Writer | null {
  return myRole && viewer?.profile
    ? { userId: viewer.userId, name: viewer.profile.username, color: viewer.profile.author_color }
    : null;
}

/** Members' names and Author Colors, for tinting and labelling `author` marks. */
export function storyAuthors({
  members,
}: {
  members: { profile: { id: string; username: string; author_color: string } }[];
}): StoryAuthor[] {
  return members.map(({ profile }) => ({ id: profile.id, name: profile.username, color: profile.author_color }));
}
