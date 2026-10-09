import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** The front page's lists are the same for every visitor, so they're fetched without the request's cookies. */
function anonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/** "Being written now": up to three live Public Stories, cached for a minute. */
export const getLiveStories = unstable_cache(
  async () => {
    const { data } = await anonClient().rpc("live_public_stories");
    return data ?? [];
  },
  ["live-public-stories"],
  { revalidate: 60 }
);

/** "Recently Finished", the fallback when nothing is live: the three latest Finished Public Stories. */
export const getRecentlyFinished = unstable_cache(
  async () => {
    const { data } = await anonClient().rpc("finished_public_stories");
    return data ?? [];
  },
  ["finished-public-stories"],
  { revalidate: 60 }
);
