"use server";

import type { JSONContent } from "@tiptap/core";
import { createClient } from "@/lib/supabase/server";
import { fetchSnapshotContent, restoreSnapshotLive, takeSnapshotLive } from "@/lib/sync";
import { errorText, isUuid, type ActionResult } from "@/lib/action-result";
import { SNAPSHOT_KINDS, type SnapshotKind } from "@/lib/snapshots";

const GONE = "That Snapshot no longer exists.";
const NAME_TOO_LONG = "Keep names under 80 characters.";

const documentGone = (kind: SnapshotKind) => `That ${SNAPSHOT_KINDS[kind].noun} no longer exists.`;
const unreachable = (kind: SnapshotKind) => `Couldn't reach the live ${SNAPSHOT_KINDS[kind].noun}. Try again.`;

export type SnapshotPreview = { content: JSONContent; error?: never } | { content?: never; error: string };

/** RLS on chapter_snapshots and entry_snapshots only shows rows to Co-hosts and up, so seeing the row is the permission check. */
export async function previewSnapshot(kind: SnapshotKind, snapshotId: string): Promise<SnapshotPreview> {
  if (!isUuid(snapshotId)) return { error: GONE };
  const supabase = await createClient();
  const { data } = await supabase.from(SNAPSHOT_KINDS[kind].table).select("id").eq("id", snapshotId).maybeSingle();
  if (!data) return { error: GONE };

  try {
    const content = await fetchSnapshotContent(kind, snapshotId);
    return content ? { content } : { error: GONE };
  } catch (error) {
    console.error(error);
    return { error: unreachable(kind) };
  }
}

export async function restoreSnapshot(kind: SnapshotKind, snapshotId: string): Promise<ActionResult> {
  if (!isUuid(snapshotId)) return GONE;
  const supabase = await createClient();
  const { error } =
    kind === "chapter"
      ? await supabase.rpc("authorize_restore", { p_snapshot: snapshotId })
      : await supabase.rpc("authorize_entry_restore", { p_snapshot: snapshotId });
  if (error) return errorText(error);

  try {
    return (await restoreSnapshotLive(kind, snapshotId)) ? null : GONE;
  } catch (error) {
    console.error(error);
    return unreachable(kind);
  }
}

/** Co-hosts and up; an empty name leaves the Snapshot unnamed. */
export async function takeSnapshot(kind: SnapshotKind, id: string, name: string): Promise<ActionResult> {
  if (!isUuid(id)) return documentGone(kind);
  const trimmed = name.trim();
  if (trimmed.length > 80) return NAME_TOO_LONG;

  const supabase = await createClient();
  const { error } =
    kind === "chapter"
      ? await supabase.rpc("authorize_snapshot", { p_chapter: id })
      : await supabase.rpc("authorize_entry_snapshot", { p_entry: id });
  if (error) return errorText(error);

  try {
    const result = await takeSnapshotLive(kind, id, trimmed || null);
    if (result === "unchanged") return "Nothing has changed since the last Snapshot.";
    if (result === "gone") return documentGone(kind);
    return null;
  } catch (error) {
    console.error(error);
    return unreachable(kind);
  }
}

/** Co-hosts and up (RLS). An empty name clears it. */
export async function nameSnapshot(kind: SnapshotKind, snapshotId: string, name: string): Promise<ActionResult> {
  if (!isUuid(snapshotId)) return GONE;
  const trimmed = name.trim();
  if (trimmed.length > 80) return NAME_TOO_LONG;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(SNAPSHOT_KINDS[kind].table)
    .update({ name: trimmed || null })
    .eq("id", snapshotId)
    .select("id");
  if (error) return errorText(error);
  if (!data.length) return errorText({ message: "not_allowed" });
  return null;
}
