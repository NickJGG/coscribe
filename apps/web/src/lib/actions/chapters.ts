"use server";

import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { refreshSyncAccess } from "@/lib/sync";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";

const INVALID = "Something went wrong. Try again.";

function readTitle(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const titleError = !title
    ? "Give the Chapter a title."
    : title.length > 120
      ? "Keep titles under 120 characters."
      : null;
  return { title, titleError };
}

export async function addChapter(storyId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}`);
  const { title, titleError } = readTitle(formData);
  if (titleError) return titleError;

  const supabase = await createClient();
  const { data: chapterId, error } = await supabase.rpc("add_chapter", { p_story: storyId, p_title: title });
  if (error) return errorText(error);

  // The desk sidebar lives in a layout the redirect would otherwise keep.
  revalidatePath(`/stories/${storyId}`, "layout");
  redirect(`/stories/${storyId}/chapters/${chapterId}`);
}

export async function renameChapter(
  storyId: string,
  chapterId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(chapterId)) return INVALID;
  await requireProfile(`/stories/${storyId}`);
  const { title, titleError } = readTitle(formData);
  if (titleError) return titleError;

  const supabase = await createClient();
  const { data, error } = await supabase.from("chapters").update({ title }).eq("id", chapterId).select("id");
  if (error) return errorText(error);
  if (!data.length) return errorText({ message: "not_allowed" });

  refresh();
  return null;
}

/** Locked Chapters are read-only for everyone; open editors switch over live. */
export async function setChapterLocked(storyId: string, chapterId: string, locked: boolean): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(chapterId)) return INVALID;
  await requireProfile(`/stories/${storyId}`);

  const supabase = await createClient();
  const { data, error } = await supabase.from("chapters").update({ locked }).eq("id", chapterId).select("id");
  if (error) return errorText(error);
  if (!data.length) return errorText({ message: "not_allowed" });

  await refreshSyncAccess(storyId);
  refresh();
  return null;
}

/** Moves the Chapter to just after `afterId`, or first when it's null. */
export async function moveChapterTo(storyId: string, chapterId: string, afterId: string | null): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(chapterId) || (afterId !== null && !isUuid(afterId))) return INVALID;
  await requireProfile(`/stories/${storyId}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_chapter_to", { p_chapter: chapterId, p_after: afterId ?? undefined });
  if (error) return errorText(error);

  refresh();
  return null;
}

export async function deleteChapter(storyId: string, chapterId: string): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(chapterId)) return INVALID;
  await requireProfile(`/stories/${storyId}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_chapter", { p_chapter: chapterId });
  if (error) return errorText(error);

  await refreshSyncAccess(storyId);
  redirect(`/stories/${storyId}?trashed=chapter:${chapterId}`);
}

/** `undo` is the deleter taking it straight back, which withdraws the Trash notifications instead of following them up. */
export async function restoreChapter(storyId: string, chapterId: string, undo = false): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(chapterId)) return INVALID;
  await requireProfile(`/stories/${storyId}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_chapter", { p_chapter: chapterId, p_undo: undo });
  if (error) return errorText(error);

  revalidatePath(`/stories/${storyId}`, "layout");
  return null;
}
