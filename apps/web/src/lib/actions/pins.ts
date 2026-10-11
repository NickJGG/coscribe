"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";

// No refresh(): the Pinned Entries provider updates optimistically.

const INVALID = "Something went wrong. Try again.";

export async function pinEntry(storyId: string, entryId: string): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(entryId)) return INVALID;
  const { userId } = await requireProfile(`/stories/${storyId}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("pinned_entries")
    .upsert({ user_id: userId, story_id: storyId, entry_id: entryId }, { ignoreDuplicates: true });
  return errorText(error);
}

export async function unpinEntry(storyId: string, entryId: string): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(entryId)) return INVALID;
  const { userId } = await requireProfile(`/stories/${storyId}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("pinned_entries")
    .delete()
    .eq("user_id", userId)
    .eq("story_id", storyId)
    .eq("entry_id", entryId);
  return errorText(error);
}
