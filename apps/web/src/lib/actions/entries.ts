"use server";

import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { blockTexts, entryNamed, type ContentJSON } from "@coscribe/editor";
import { fetchStoryContent, refreshSyncAccess } from "@/lib/sync";
import { getEntries } from "@/lib/story";
import { mentionEntries, readEntryFields, readEntryPatch, type EntryPatch, type EntryType } from "@/lib/entries";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";

const INVALID = "Something went wrong. Try again.";
const NOT_ALLOWED = errorText({ message: "not_allowed" });

export async function addEntry(storyId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}`);
  const read = readEntryFields(formData);
  if ("error" in read) return read.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entries")
    .insert({ story_id: storyId, ...read.fields })
    .select("id")
    .single();
  // RLS rejects non-Writers and Finished stories alike.
  if (error) return NOT_ALLOWED;

  // The desk sidebar lives in a layout the redirect would otherwise keep.
  revalidatePath(`/stories/${storyId}`, "layout");
  redirect(`/stories/${storyId}/bible/${data.id}`);
}

/**
 * Adds an Entry named from selected prose, leaving the Writer where they are. Refuses a name that's already
 * an Entry's name or Alias, so this path doesn't make duplicates; the sidebar form still can.
 */
export async function addEntryFromText(storyId: string, name: string, type: EntryType): Promise<ActionResult> {
  if (!isUuid(storyId)) return INVALID;
  await requireProfile(`/stories/${storyId}`);
  const read = readEntryPatch({ name, type });
  if ("error" in read) return read.error;
  if (!read.columns.name || !read.columns.type) return INVALID;

  const existing = entryNamed(read.columns.name, mentionEntries(await getEntries(storyId)));
  if (existing) return `“${existing.name}” is already in the Story Bible.`;

  const supabase = await createClient();
  const { error } = await supabase
    .from("entries")
    .insert({ story_id: storyId, type: read.columns.type, name: read.columns.name });
  if (error) return NOT_ALLOWED;

  refresh();
  return null;
}

/** Saves Entry fields edited in place: name, type, description, Aliases, or the Mentions switch. */
export async function editEntry(storyId: string, entryId: string, patch: EntryPatch): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(entryId)) return INVALID;
  await requireProfile(`/stories/${storyId}/bible/${entryId}`);
  const read = readEntryPatch(patch);
  if ("error" in read) return read.error;

  const supabase = await createClient();
  const { data, error } = await supabase.from("entries").update(read.columns).eq("id", entryId).select("id");
  if (error) return errorText(error);
  if (!data.length) return NOT_ALLOWED;

  refresh();
  return null;
}

export async function renameEntry(
  storyId: string,
  entryId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  return editEntry(storyId, entryId, { name: String(formData.get("name") ?? "") });
}

const PREVIEW_CHARS = 240;

/** The opening of an Entry's body for a Mention's card. Null if it's empty, unreadable, or out of reach. */
export async function getEntryPreview(storyId: string, entryId: string): Promise<string | null> {
  if (!isUuid(storyId) || !isUuid(entryId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("entries").select("id").eq("story_id", storyId).eq("id", entryId).maybeSingle();
  if (!data) return null;

  const body = (await fetchStoryContent(storyId))?.entry[entryId];
  if (!body) return null;
  const text = blockTexts(body as ContentJSON).join(" ").replace(/\s+/gu, " ").trim();
  if (text.length <= PREVIEW_CHARS) return text || null;
  return `${text.slice(0, PREVIEW_CHARS).replace(/\s+\S*$/u, "")}…`;
}

export async function deleteEntry(storyId: string, entryId: string): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(entryId)) return INVALID;
  await requireProfile(`/stories/${storyId}/bible/${entryId}`);

  const supabase = await createClient();
  const { data, error } = await supabase.from("entries").delete().eq("id", entryId).select("id");
  if (error) return errorText(error);
  if (!data.length) return NOT_ALLOWED;

  await refreshSyncAccess(storyId);
  redirect(`/stories/${storyId}`);
}
