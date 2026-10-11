"use server";

import { revalidatePath } from "next/cache";
import type { TextPoint } from "@coscribe/editor";
import { createClient } from "@/lib/supabase/server";
import { getChapters, getStory } from "@/lib/story";
import { isWriter } from "@/lib/story-roles";
import { featurePassage as featurePassageLive } from "@/lib/sync";
import { requireProfile } from "@/lib/viewer";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";

const CHAPTER_GONE = "That Chapter no longer exists.";

/** Features the text between two points of a Chapter on the viewer's profile. Members of a Finished Story only. */
export async function featurePassage(storyId: string, chapterId: string, from: TextPoint, to: TextPoint): Promise<ActionResult> {
  const { userId, profile } = await requireProfile(`/stories/${storyId}/read/${chapterId}`);
  if (!isUuid(chapterId)) return CHAPTER_GONE;
  const [data, chapters] = await Promise.all([getStory(storyId), getChapters(storyId)]);
  if (!data || !isWriter(data.myRole)) return "Only this Story's Writers can feature its text.";
  if (data.story.status !== "finished") return "Only a Finished Story's text can be featured.";
  if (!chapters.some((c) => c.id === chapterId)) return CHAPTER_GONE;

  try {
    const result = await featurePassageLive(chapterId, { userId, from, to });
    if (result === "gone") return CHAPTER_GONE;
    if (result) return result;
  } catch (error) {
    console.error(error);
    return "Couldn't save the passage. Try again.";
  }
  revalidatePath(`/u/${profile.username}`);
  return null;
}

export async function removeFeaturedPassage(): Promise<ActionResult> {
  const { userId, profile } = await requireProfile("/");
  const supabase = await createClient();
  const { error } = await supabase.from("featured_passages").delete().eq("user_id", userId);
  if (error) return errorText(error);
  revalidatePath(`/u/${profile.username}`);
  return null;
}
