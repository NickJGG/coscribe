"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { refreshSyncAccess } from "@/lib/sync";
import { errorText, type ActionResult } from "@/lib/action-result";
import { transferHost } from "./stories";

/** The delete page's Make Host: `transferHost` with the Writer picked in the form. */
export async function handOverStory(storyId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return transferHost(storyId, String(formData.get("user") ?? ""));
}

export async function deleteAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireProfile("/settings/delete-account");

  const supabase = await createClient();
  const { data: storyIds, error } = await supabase.rpc("delete_account", {
    p_username: String(formData.get("username") ?? ""),
  });
  if (error) return errorText(error);

  await Promise.all(storyIds.map(refreshSyncAccess));
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
