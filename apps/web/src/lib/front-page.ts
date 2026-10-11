import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { NO_DETAILS, storyCardDetails } from "@/lib/story-cards";

/** The front page's lists are the same for every visitor, so they're fetched without the request's cookies. */
function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** The cache stores JSON, so details are merged into each row rather than kept in a Map. */
async function withDetails<T extends { id: string }>(supabase: ReturnType<typeof anonClient>, rows: T[]) {
  const details = await storyCardDetails(supabase, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, ...(details.get(r.id) ?? NO_DETAILS) }));
}

/** "Being written now": up to three live Public Stories, cached for a minute. */
export const getLiveStories = unstable_cache(
  async () => {
    const supabase = anonClient();
    const { data } = await supabase.rpc("live_public_stories");
    return withDetails(supabase, data ?? []);
  },
  ["live-public-stories"],
  { revalidate: 60 }
);

/** "Recently Finished", the fallback when nothing is live: the three latest Finished Public Stories. */
export const getRecentlyFinished = unstable_cache(
  async () => {
    const supabase = anonClient();
    const { data } = await supabase.rpc("finished_public_stories");
    return withDetails(supabase, data ?? []);
  },
  ["finished-public-stories"],
  { revalidate: 60 }
);
