"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { refreshSyncAccess } from "@/lib/sync";
import { readEntryFields } from "@/lib/entries";
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

  redirect(`/stories/${storyId}/bible/${data.id}`);
}

export async function updateEntry(
  storyId: string,
  entryId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!isUuid(storyId) || !isUuid(entryId)) return INVALID;
  await requireProfile(`/stories/${storyId}/bible/${entryId}`);
  const read = readEntryFields(formData);
  if ("error" in read) return read.error;

  const supabase = await createClient();
  const { data, error } = await supabase.from("entries").update(read.fields).eq("id", entryId).select("id");
  if (error) return errorText(error);
  if (!data.length) return NOT_ALLOWED;

  refresh();
  return null;
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
