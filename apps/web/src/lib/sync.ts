/**
 * Asks apps/sync to re-check every open connection to a story, after anything that changes who may
 * view or edit it. Best effort: if the sync server is down, there are no connections to update.
 */
export async function refreshSyncAccess(storyId: string) {
  const url = process.env.NEXT_PUBLIC_SYNC_URL?.replace(/^ws/, "http");
  const secret = process.env.SYNC_SECRET;
  if (!url || !secret) return;

  try {
    const response = await fetch(`${url}/stories/${storyId}/refresh`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) console.error(`sync refresh for ${storyId} failed: ${response.status}`);
  } catch (error) {
    console.error(`sync refresh for ${storyId} failed`, error);
  }
}
