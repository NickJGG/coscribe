"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { refreshSyncAccess } from "@/lib/sync";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";
import { readStoryForm } from "@/lib/story-form";
import type { MemberRole } from "@/lib/story-roles";

const INVALID = "Something went wrong. Try again.";

export async function createStory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile("/stories");
  const { title, visibility, blurb, error: formError } = readStoryForm(formData);
  if (formError) return formError;

  const supabase = await createClient();
  const { data: storyId, error } = await supabase.rpc("create_story", {
    p_title: title,
    p_visibility: visibility,
    p_blurb: blurb ?? undefined,
  });
  if (error) return errorText(error);

  redirect(`/stories/${storyId}`);
}

export async function updateStory(storyId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);
  const { title, visibility, blurb, error: formError } = readStoryForm(formData);
  if (formError) return formError;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stories")
    .update({ title, visibility, blurb })
    .eq("id", storyId)
    .select("id");
  if (error) return errorText(error);
  if (!data.length) return errorText({ message: "not_allowed" });

  await refreshSyncAccess(storyId);
  refresh();
  return null;
}

export async function deleteStory(storyId: string): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_story", { p_story: storyId });
  if (error) return errorText(error);

  await refreshSyncAccess(storyId);
  redirect("/stories");
}

export async function setMemberRole(storyId: string, userId: string, role: MemberRole): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(userId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_story: storyId, p_user: userId, p_role: role });
  if (error) return errorText(error);

  refresh();
  return null;
}

export async function removeMember(storyId: string, userId: string): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(userId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_story: storyId, p_user: userId });
  if (error) return errorText(error);

  await refreshSyncAccess(storyId);
  refresh();
  return null;
}

export async function transferHost(storyId: string, userId: string): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(userId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_host", { p_story: storyId, p_user: userId });
  if (error) return errorText(error);

  refresh();
  return null;
}

export async function leaveStory(storyId: string): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_story", { p_story: storyId });
  if (error) return errorText(error);

  await refreshSyncAccess(storyId);
  redirect("/stories");
}

/** Host only. Open editors switch to read-only (or back) live. */
export async function setStoryFinished(storyId: string, finished: boolean): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_story_finished", { p_story: storyId, p_finished: finished });
  if (error) return errorText(error);

  await refreshSyncAccess(storyId);
  refresh();
  return null;
}

export async function setStoryColor(storyId: string, color: string): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_story_color", { p_story: storyId, p_color: color });
  if (error) return errorText(error);

  refresh();
  return null;
}
