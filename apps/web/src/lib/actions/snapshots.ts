"use server";

import type { JSONContent } from "@tiptap/core";
import { createClient } from "@/lib/supabase/server";
import { fetchSnapshotContent, restoreSnapshotLive, takeSnapshotLive } from "@/lib/sync";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";

const GONE = "That Snapshot no longer exists.";
const CHAPTER_GONE = "That Chapter no longer exists.";
const UNREACHABLE = "Couldn't reach the live Chapter. Try again.";
const NAME_TOO_LONG = "Keep names under 80 characters.";

export type SnapshotPreview = { content: JSONContent; error?: never } | { content?: never; error: string };

/** RLS on chapter_snapshots only shows rows to Co-hosts and up, so seeing the row is the permission check. */
export async function previewSnapshot(snapshotId: string): Promise<SnapshotPreview> {
  if (!isUuid(snapshotId)) return { error: GONE };
  const supabase = await createClient();
  const { data } = await supabase.from("chapter_snapshots").select("id").eq("id", snapshotId).maybeSingle();
  if (!data) return { error: GONE };

  try {
    const content = await fetchSnapshotContent(snapshotId);
    return content ? { content } : { error: GONE };
  } catch (error) {
    console.error(error);
    return { error: UNREACHABLE };
  }
}

export async function restoreSnapshot(snapshotId: string): Promise<ActionResult> {
  if (!isUuid(snapshotId)) return GONE;
  const supabase = await createClient();
  const { error } = await supabase.rpc("authorize_restore", { p_snapshot: snapshotId });
  if (error) return errorText(error);

  try {
    return (await restoreSnapshotLive(snapshotId)) ? null : GONE;
  } catch (error) {
    console.error(error);
    return UNREACHABLE;
  }
}

/** Co-hosts and up; an empty name leaves the Snapshot unnamed. */
export async function takeSnapshot(chapterId: string, name: string): Promise<ActionResult> {
  if (!isUuid(chapterId)) return CHAPTER_GONE;
  const trimmed = name.trim();
  if (trimmed.length > 80) return NAME_TOO_LONG;

  const supabase = await createClient();
  const { error } = await supabase.rpc("authorize_snapshot", { p_chapter: chapterId });
  if (error) return errorText(error);

  try {
    const result = await takeSnapshotLive(chapterId, trimmed || null);
    if (result === "unchanged") return "Nothing has changed since the last Snapshot.";
    if (result === "gone") return CHAPTER_GONE;
    return null;
  } catch (error) {
    console.error(error);
    return UNREACHABLE;
  }
}

/** Co-hosts and up (RLS). An empty name clears it. */
export async function nameSnapshot(snapshotId: string, name: string): Promise<ActionResult> {
  if (!isUuid(snapshotId)) return GONE;
  const trimmed = name.trim();
  if (trimmed.length > 80) return NAME_TOO_LONG;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapter_snapshots")
    .update({ name: trimmed || null })
    .eq("id", snapshotId)
    .select("id");
  if (error) return errorText(error);
  if (!data.length) return errorText({ message: "not_allowed" });
  return null;
}
