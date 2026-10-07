import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** The signed-in user and their profile (null until onboarding is done), or null when signed out. */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, author_color, theme, created_at")
    .eq("id", userId)
    .maybeSingle();

  return { userId, profile };
});

/** Sends anyone without a finished profile to sign in or onboarding, then back to `next`. */
export async function requireProfile(next: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!viewer.profile) redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return { userId: viewer.userId, profile: viewer.profile };
}
