import type { JSONContent } from "@tiptap/core";

/** A server-to-server call to apps/sync, authorized with SYNC_SECRET. Callers check permissions first. */
async function syncFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SYNC_URL?.replace(/^ws/, "http");
  const secret = process.env.SYNC_SECRET;
  if (!url || !secret) throw new Error("NEXT_PUBLIC_SYNC_URL and SYNC_SECRET must be set");

  return fetch(`${url}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(5000),
  });
}

/**
 * Asks apps/sync to re-check every open connection to a story, after anything that changes who may
 * view or edit it. Best effort: if the sync server is down, there are no connections to update.
 */
export async function refreshSyncAccess(storyId: string) {
  try {
    const response = await syncFetch(`/stories/${storyId}/refresh`, { method: "POST" });
    if (!response.ok) console.error(`sync refresh for ${storyId} failed: ${response.status}`);
  } catch (error) {
    console.error(`sync refresh for ${storyId} failed`, error);
  }
}

/** A Snapshot's text, with its `author` marks. Null if it's gone. */
export async function fetchSnapshotContent(snapshotId: string): Promise<JSONContent | null> {
  const response = await syncFetch(`/snapshots/${snapshotId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`snapshot preview failed: ${response.status}`);
  return ((await response.json()) as { content: JSONContent }).content;
}

/** Applies a Snapshot to the live Chapter. False if it's gone. */
export async function restoreSnapshotLive(snapshotId: string): Promise<boolean> {
  const response = await syncFetch(`/snapshots/${snapshotId}/restore`, { method: "POST" });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`snapshot restore failed: ${response.status}`);
  return true;
}
