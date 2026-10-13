"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { IMPORTED_AUTHOR } from "@coscribe/editor";
import { importStoryContent, refreshSyncAccess } from "@/lib/sync";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";
import { readStoryForm } from "@/lib/story-form";
import type { MemberRole } from "@/lib/story-roles";
import { isStoryNotify } from "@/lib/notifications";
import { fromMarkdown } from "@/lib/story-file/markdown";
import { IMPORT_MAX_BYTES, IMPORT_MAX_CHAPTERS, importContent } from "@/lib/story-file/import";
import type { StoryFile } from "@/lib/story-file/types";

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

/**
 * A new Story from a Markdown or plain-text file, parsed again here rather than trusting the browser's parse. With
 * `mine` the text is credited to the importer, else it's Imported Text. If sync can't take it, the Story goes to the
 * Trash.
 */
export async function importStory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireProfile("/stories");
  const { title, visibility, blurb, error: formError } = readStoryForm(formData);
  if (formError) return formError;

  const upload = formData.get("file");
  if (!(upload instanceof File) || !upload.size) return "Choose a file to import.";
  if (upload.size > IMPORT_MAX_BYTES) return "That file is over 2 MB, too big to import.";
  let file: StoryFile;
  try {
    file = fromMarkdown(await upload.text(), upload.name).file;
  } catch {
    return "Couldn't read that file. Import a Markdown (.md) or plain text (.txt) file.";
  }
  if (file.chapters.length > IMPORT_MAX_CHAPTERS) {
    return `That file has ${file.chapters.length} Chapters. A Story can import up to ${IMPORT_MAX_CHAPTERS}.`;
  }
  const author = { userId: formData.get("mine") ? me.userId : IMPORTED_AUTHOR, at: Date.now() };

  const supabase = await createClient();
  const { data: storyId, error } = await supabase.rpc("create_story", {
    p_title: title,
    p_visibility: visibility,
    p_blurb: blurb ?? undefined,
  });
  if (error) return errorText(error);

  try {
    await importStoryContent(storyId, me.userId, importContent(file, author));
  } catch (importError) {
    console.error(`import into ${storyId} failed`, importError);
    await supabase.rpc("delete_story", { p_story: storyId });
    await refreshSyncAccess(storyId);
    return "Couldn't import that file. Nothing was kept.";
  }
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
  redirect(`/stories?trashed=story:${storyId}`);
}

/** Host only, from their Trash or the Undo after deleting. */
export async function restoreStory(storyId: string): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile("/stories");

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_story", { p_story: storyId });
  if (error) return errorText(error);

  refresh();
  return null;
}

/** Host only. Purges the Story's trashed Chapters and Entries, even once it's Finished. */
export async function emptyTrash(storyId: string): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings/trash`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("empty_trash", { p_story: storyId });
  if (error) return errorText(error);

  refresh();
  return null;
}

/** Purges every Story in the caller's Trash. */
export async function emptyStoryTrash(): Promise<ActionResult> {
  await requireProfile("/stories/trash");

  const supabase = await createClient();
  const { error } = await supabase.rpc("empty_story_trash");
  if (error) return errorText(error);

  refresh();
  return null;
}

export async function setMemberRole(storyId: string, userId: string, role: MemberRole): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(userId)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { p_story: storyId, p_user: userId, p_role: role });
  if (error) return errorText(error);

  await refreshSyncAccess(storyId);
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

export async function setStoryNotify(storyId: string, value: string): Promise<ActionResult> {
  if (!isUuid(storyId) || !isStoryNotify(value)) return INVALID;
  await requireProfile(`/stories/${storyId}/settings`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_story_notify", { p_story: storyId, p_notify: value });
  if (error) return errorText(error);

  refresh();
  return null;
}
