import { isUuid } from "@/lib/action-result";
import { byJoinOrder } from "@/lib/contribution";
import { bandSegments } from "@/lib/og/band";
import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og/card";
import { SiteCard } from "@/lib/og/site";
import { StoryCard } from "@/lib/og/story";
import { storyCardDetails } from "@/lib/story-cards";
import { isWriter } from "@/lib/story-roles";
import { anonClient } from "@/lib/supabase/anon";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "A Story on Coscribe";
export const revalidate = 300;

/** Drawn as a signed-out visitor sees it, so a Private Story gets the site's card. */
export default async function Image(props: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await props.params;
  const story = isUuid(storyId) ? await loadStory(storyId) : null;
  if (!story) return ogImage(<SiteCard />);

  const written = story.ribbon.filter((s) => s.chars > 0);
  return ogImage(
    <StoryCard
      title={story.title}
      blurb={story.blurb}
      finished={story.status === "finished"}
      writers={(written.length ? written : story.writers).map((w) => w.name)}
      band={bandSegments(story.ribbon, story.writers.map((w) => w.color))}
    />
  );
}

async function loadStory(id: string) {
  const anon = anonClient();
  const [{ data: story }, details] = await Promise.all([
    anon
      .from("stories")
      .select("title, blurb, status, members:story_members (role, joined_at, author_color, profile:profiles (username, author_color))")
      .eq("id", id)
      .maybeSingle(),
    storyCardDetails(anon, [id]),
  ]);
  if (!story) return null;
  const writers = story.members
    .filter((m) => isWriter(m.role))
    .map((m) => ({
      name: m.profile.username,
      color: m.author_color ?? m.profile.author_color,
      role: m.role,
      joinedAt: m.joined_at,
    }))
    .sort(byJoinOrder);
  return { ...story, writers, ribbon: details.get(id)?.ribbon ?? [] };
}
