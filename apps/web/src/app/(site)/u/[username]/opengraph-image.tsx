import type { JSONContent } from "@tiptap/core";
import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og/card";
import { ProfileCard } from "@/lib/og/profile";
import { SiteCard } from "@/lib/og/site";
import { plainText } from "@/lib/og/text";
import { anonClient } from "@/lib/supabase/anon";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "A Writer on Coscribe";
export const revalidate = 300;

/** Drawn as a signed-out visitor sees it: RLS hides a Featured Passage whose Story isn't Public and Finished. */
export default async function Image(props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params;
  const anon = anonClient();
  const { data: profile } = await anon
    .from("profiles")
    .select("id, username, author_color, bio, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!profile) return ogImage(<SiteCard />);

  const { data: featured } = await anon
    .from("featured_passages")
    .select("content, story:stories (title)")
    .eq("user_id", profile.id)
    .maybeSingle();
  const text = plainText(featured?.content as JSONContent | undefined);

  return ogImage(
    <ProfileCard
      username={profile.username}
      color={profile.author_color}
      bio={profile.bio}
      since={new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      passage={text && featured?.story ? { text, from: featured.story.title } : null}
    />
  );
}
