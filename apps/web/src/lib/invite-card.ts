import { anonClient } from "@/lib/supabase/anon";

type CardWriter = { id: string; name: string; color: string; chars: number };

/** What a live Invite Link's share card and link preview show; null for a used, expired or unknown link. */
export async function inviteLinkCard(token: string) {
  const { data } = await anonClient().rpc("invite_link_card", { p_token: token }).maybeSingle();
  if (!data) return null;
  const writers = (data.writers as { id: string; username: string; color: string; chars: number }[]).map(
    (w): CardWriter => ({ id: w.id, name: w.username, color: w.color, chars: w.chars })
  );
  return {
    title: data.story_title,
    blurb: (data.story_blurb as string | null) || null,
    reading: data.role === "viewer",
    expiresAt: data.expires_at as string | null,
    inviter: data.inviter_username,
    inviterColor: data.inviter_color,
    writers,
  };
}
