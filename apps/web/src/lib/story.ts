import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { isUuid } from "@/lib/action-result";
import type { MemberRole } from "@/lib/story-roles";

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
