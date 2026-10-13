import type { JSONContent } from "@tiptap/core";
import type { TextPoint } from "@coscribe/editor";
import type { StoryFile } from "@/lib/story-file/types";

/** A server-to-server call to apps/sync, authorized with SYNC_SECRET. Callers check permissions first. */
async function syncFetch(path: string, init: RequestInit = {}, timeout = 5000): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SYNC_URL?.replace(/^ws/, "http");
  const secret = process.env.SYNC_SECRET;
  if (!url || !secret) throw new Error("NEXT_PUBLIC_SYNC_URL and SYNC_SECRET must be set");

  return fetch(`${url}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${secret}`, ...(init.body && { "content-type": "application/json" }) },
    signal: AbortSignal.timeout(timeout),
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

/** Snapshots the live Chapter now, unless nothing changed since the last Snapshot. */
export async function takeSnapshotLive(chapterId: string, name: string | null): Promise<"taken" | "unchanged" | "gone"> {
  const response = await syncFetch(`/chapters/${chapterId}/snapshot`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (response.status === 404) return "gone";
  if (response.status === 409) return "unchanged";
  if (!response.ok) throw new Error(`snapshot failed: ${response.status}`);
  return "taken";
}

/** An Outline's non-empty fields, defaults first, and its Characters' Entry ids. */
export type OutlineContent = { fields: { id: string; label: string; content: JSONContent }[]; characters: string[] };

export type StoryContent = Record<"chapter" | "entry", Record<string, JSONContent>> & {
  outline?: Record<string, OutlineContent>;
};

/**
 * Every Chapter and Entry body in a story, keyed by id, and with `outlines` every Outline with content, keyed by
 * Chapter id. Null if the sync server can't be reached.
 */
export async function fetchStoryContent(storyId: string, { outlines = false } = {}): Promise<StoryContent | null> {
  try {
    const response = await syncFetch(`/stories/${storyId}/content${outlines ? "?outlines=1" : ""}`);
    if (!response.ok) throw new Error(`story content failed: ${response.status}`);
    return (await response.json()) as StoryContent;
  } catch (error) {
    console.error(`story content for ${storyId} failed`, error);
    return null;
  }
}

export type ImportContent = Pick<StoryFile, "chapters" | "entries">;

/** Fills a just-created Story, Hosted by `userId`, with an imported file's Chapters, Outlines and Entries. */
export async function importStoryContent(storyId: string, userId: string, content: ImportContent): Promise<void> {
  const response = await syncFetch(
    `/stories/${storyId}/import`,
    { method: "POST", body: JSON.stringify({ userId, ...content }) },
    60_000
  );
  if (!response.ok) throw new Error(`story import failed: ${response.status}`);
}

/** Saves the User's Featured Passage from a Chapter. The reason it can't be featured, "gone", or null when saved. */
export async function featurePassage(
  chapterId: string,
  body: { userId: string; from: TextPoint; to: TextPoint }
): Promise<string | "gone" | null> {
  const response = await syncFetch(`/chapters/${chapterId}/feature`, { method: "POST", body: JSON.stringify(body) });
  if (response.status === 404) return "gone";
  if (response.status === 422) return ((await response.json()) as { error: string }).error;
  if (!response.ok) throw new Error(`feature passage failed: ${response.status}`);
  return null;
}
