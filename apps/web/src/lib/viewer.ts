import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user and their profile (null until onboarding is done), or null when signed out. */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, author_color, created_at")
    .eq("id", userId)
    .maybeSingle();

  return { userId, profile };
});
