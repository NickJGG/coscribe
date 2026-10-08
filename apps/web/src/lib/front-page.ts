import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * "Being written now": up to three live Public Stories, the same for every visitor, so it's fetched
 * without the request's cookies and cached for a minute.
 */
export const getLiveStories = unstable_cache(
  async () => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data } = await supabase.rpc("live_public_stories");
    return data ?? [];
  },
  ["live-public-stories"],
  { revalidate: 60 }
);
