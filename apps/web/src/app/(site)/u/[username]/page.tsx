import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getFriendships } from "@/lib/connections";
import { relationTo, type Relation } from "@/lib/friends";
import { formerWriterIds, profileStories, profileStoryRows, writesWith, type CoWriter, type ProfileStory, type ProfileStoryRow } from "@/lib/profile";
import { formerWriterNames } from "@/lib/story";
import { authorColorCss } from "@/lib/profile-rules";
import type { JSONContent } from "@tiptap/core";
import { Avatar } from "@/components/Avatar";
import { LiveLabel } from "@/components/LiveCounts";
import { StorySection } from "@/components/StoryCard";
import { FeaturedPassage, type Passage } from "./FeaturedPassage";
import { FriendAction } from "./FriendAction";
import { ProfileStoryCard } from "./ProfileStoryCard";
import { WritingDays, type WritingHistory } from "./WritingDays";
import styles from "./profile.module.css";

const getProfile = cache(async (username: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, author_color, bio, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
});

export async function generateMetadata(props: PageProps<"/u/[username]">): Promise<Metadata> {
  const profile = await getProfile((await props.params).username);
  return { title: profile?.username ?? "Not found", description: profile?.bio ?? undefined };
}

export default async function ProfilePage(props: PageProps<"/u/[username]">) {
  const profile = await getProfile((await props.params).username);
  if (!profile) notFound();

  const supabase = await createClient();
  const [viewer, { data: rows }, { data: writingNow }, { data: featured }, { data: history }] = await Promise.all([
    getViewer(),
    profileStoryRows(supabase, profile.id),
    supabase.rpc("writing_now", { p_user: profile.id }),
    supabase
      .from("featured_passages")
      .select("story_id, chapter_id, content, story:stories (title, status, chapters (id, position))")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase.rpc("writing_history", { p_user: profile.id }),
  ]);
  const viewerId = viewer?.profile ? viewer.userId : null;
  const self = viewerId === profile.id;
  const [formerNames, relation] = await Promise.all([
    formerWriterNames(formerWriterIds(rows ?? [])),
    viewerRelation(viewerId, profile.id),
  ]);

  const { together, finished, writing } = profileStories(rows ?? [], profile.id, viewerId, formerNames);
  const coWriters = writesWith(rows ?? [], profile.id);
  const live = writingNow?.[0];
  const since = new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const justThem = new Set([profile.id]);
  const bothOfUs = viewerId ? new Set([profile.id, viewerId]) : justThem;
  const passage = featured && featuredPassage(featured, rows ?? [], profile);

  return (
    <div className={styles.page} style={{ "--author": authorColorCss(profile.author_color) } as React.CSSProperties}>
      <div className={styles.layout}>
        <aside className={styles.aside}>
          <span className={styles.avatar} aria-hidden>
            {profile.username[0]!.toUpperCase()}
          </span>
          <div className={styles.who}>
            <h1>{profile.username}</h1>
            {profile.bio ? (
              <p className={styles.bio}>{profile.bio}</p>
            ) : (
              self && (
                <p className={`muted ${styles.nudge}`}>
                  <Link href="/settings">Add a bio</Link> so people know who you are.
                </p>
              )
            )}
            <p className={`muted ${styles.since}`}>Writing on Coscribe since {since}</p>
          </div>
          {relation && <FriendAction relation={relation} user={profile} />}
          {live && (
            <Link href={`/stories/${live.story_id}/chapters/${live.chapter_id}`} className={styles.live}>
              <span className={styles.liveHead}>
                <LiveLabel>Writing now</LiveLabel>
              </span>
              <span className={styles.liveStory}>{live.story_title}</span>
              <span className={styles.liveSub}>Chapter {live.chapter_number} · Watch →</span>
            </Link>
          )}
          {coWriters.length > 0 && <WritesWith people={coWriters} />}
        </aside>

        <div className={styles.work}>
          <FeaturedPassage passage={passage} userId={profile.id} self={self} canFeature={finished.length > 0} />
          {history && <WritingDays history={history as WritingHistory} />}
          <Section title="Writing together" stories={together} lit={bothOfUs} />
          <Section title="Finished" stories={finished} lit={justThem} />
          <Section title="Being written" stories={writing} lit={justThem} />
          {!together.length && !finished.length && !writing.length && (
            <p className={`muted ${styles.empty}`}>
              {self ? (
                <>
                  Stories you write will show here. <Link href="/stories/new">Start a Story</Link>
                </>
              ) : (
                "No stories to show yet."
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type FeaturedRow = {
  story_id: string;
  chapter_id: string;
  content: unknown;
  story: { title: string; status: string; chapters: { id: string; position: number | null }[] };
};

function featuredPassage(
  row: FeaturedRow,
  rows: ProfileStoryRow[],
  profile: { id: string; author_color: string }
): Passage {
  const member = rows.find((r) => r.story.id === row.story_id)?.story.members.find((m) => m.profile?.id === profile.id);
  const chapters = row.story.chapters.toSorted((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return {
    storyId: row.story_id,
    storyTitle: row.story.title,
    chapterId: row.chapter_id,
    chapterNumber: chapters.findIndex((c) => c.id === row.chapter_id) + 1,
    finished: row.story.status === "finished",
    content: row.content as JSONContent,
    color: member?.author_color ?? profile.author_color,
  };
}

/** "self" on your own profile, null when signed out (no action to offer). */
async function viewerRelation(viewerId: string | null, profileId: string): Promise<Relation | "self" | null> {
  if (!viewerId) return null;
  if (viewerId === profileId) return "self";
  const { connections } = await getFriendships(viewerId);
  return relationTo(viewerId, profileId, connections);
}

function Section({ title, stories, lit }: { title: string; stories: ProfileStory[]; lit: ReadonlySet<string> }) {
  if (!stories.length) return null;
  return (
    <StorySection title={title} count={stories.length}>
      {stories.map((story) => (
        <ProfileStoryCard key={story.id} story={story} lit={lit} />
      ))}
    </StorySection>
  );
}

function WritesWith({ people }: { people: CoWriter[] }) {
  return (
    <div className={styles.with}>
      <span className={styles.label}>Writes with</span>
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/u/${p.username}`}>
              <Avatar name={p.username} color={p.color} size="sm" />
              {p.username}
            </Link>
            <span className={styles.shared} data-tip={`${p.shared} ${p.shared === 1 ? "Story" : "Stories"} together`}>
              {p.shared}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
