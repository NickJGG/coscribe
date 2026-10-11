import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer, requireProfile } from "@/lib/viewer";
import { formerWriterNames } from "@/lib/story";
import { getPendingInvites } from "@/lib/connections";
import { byJoinOrder, readAuthorChars, storyRibbon } from "@/lib/contribution";
import { presentWriters, writingLine } from "@/lib/presence";
import { relativeTime } from "@/lib/relative-time";
import { byProfileOrder } from "@/lib/profile";
import { createStory } from "@/lib/actions/stories";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { ActionForm } from "@/components/ActionForm";
import { StoryFields } from "@/components/StoryFields";
import { finishedFoot, StoryCard, StorySection } from "@/components/StoryCard";
import { PublicStories } from "./PublicStories";
import styles from "./stories.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getViewer()) ? "Your stories" : "Live stories" };
}

/** Your Stories, or for signed-out visitors the Public ones, being written first. */
export default async function StoriesPage(props: PageProps<"/stories">) {
  if (!(await getViewer())) return <PublicStories />;
  const me = await requireProfile("/stories");
  const { new: wantsNew } = await props.searchParams;
  const supabase = await createClient();

  const [invites, { data: memberships }] = await Promise.all([
    getPendingInvites(me.userId),
    supabase
      .from("story_members")
      .select(`
        role,
        story:stories (
          id, title, blurb, status, visibility, created_at, finished_at,
          chapters (id, position, word_count, author_chars, edited_at),
          members:story_members (role, joined_at, author_color, profile:profiles (id, username, author_color)),
          presence:story_presence (id, user_id, kind, document_id, connected_at)
        )
      `)
      .eq("user_id", me.userId),
  ]);

  const stories = (memberships ?? []).map(({ role, story }) => {
    const members = story.members
      .map((m) => ({
        id: m.profile.id,
        name: m.profile.username,
        color: m.author_color ?? m.profile.author_color,
        role: m.role,
        joinedAt: m.joined_at,
      }))
      .sort(byJoinOrder);
    const editedAt = story.chapters.reduce<string | null>(
      (latest, c) => (c.edited_at && (!latest || c.edited_at > latest) ? c.edited_at : latest),
      null
    );
    const chapterNumbers = new Map(
      story.chapters.toSorted((a, b) => a.position - b.position).map((c, i) => [c.id, i + 1])
    );
    const writing = writingLine(
      presentWriters(story.presence, me.userId).flatMap((w) => {
        const member = members.find((m) => m.id === w.userId);
        const chapter = w.kind === "chapter" ? (chapterNumbers.get(w.documentId) ?? null) : null;
        return member ? [{ name: member.name, chapter }] : [];
      })
    );
    return {
      ...story,
      role,
      members,
      writing,
      editedAt,
      createdAt: story.created_at,
      finishedAt: story.finished_at,
      words: story.chapters.reduce((sum, c) => sum + c.word_count, 0),
      chars: story.chapters.map((c) => readAuthorChars(c.author_chars)),
    };
  });

  const formerNames = await formerWriterNames(
    stories.flatMap((s) => {
      const memberIds = new Set(s.members.map((m) => m.id));
      return s.chars.flatMap(Object.keys).filter((id) => !memberIds.has(id));
    })
  );
  const writingStories = stories.filter((s) => s.status !== "finished").sort(byProfileOrder);
  const finishedStories = stories.filter((s) => s.status === "finished").sort(byProfileOrder);
  const card = (story: (typeof stories)[number], foot: React.ReactNode) => (
    <StoryCard
      key={story.id}
      href={`/stories/${story.id}`}
      title={story.title}
      blurb={story.blurb}
      finished={story.status === "finished"}
      role={story.role}
      private={story.visibility === "private"}
      ribbon={storyRibbon(story.members, story.chars, formerNames)}
    >
      {foot}
    </StoryCard>
  );

  return (
    <div className={styles.page}>
      <h1>Your stories</h1>

      {invites.map((invite) => (
        <div key={invite.id} className={styles.invite}>
          <span>
            {invite.inviter.username} invited you to write in{" "}
            <Link href={`/stories/${invite.story.id}`} className={styles.inviteTitle}>
              {invite.story.title}
            </Link>
          </span>
          <span className="row-actions">
            <ActionForm action={deleteInvite.bind(null, invite.id)}>
              <button className="button button-ghost button-small">Decline</button>
            </ActionForm>
            <ActionForm action={acceptInvite.bind(null, invite.id)}>
              <button className="button button-primary button-small">Join as Writer</button>
            </ActionForm>
          </span>
        </div>
      ))}

      {writingStories.length > 0 && (
        <StorySection title="Being written" count={writingStories.length}>
          {writingStories.map((story) =>
            card(
              story,
              story.writing ? (
                <span className={styles.writing}>{story.writing}</span>
              ) : story.editedAt ? (
                `Edited ${relativeTime(Date.parse(story.editedAt))}`
              ) : (
                "No words yet"
              )
            )
          )}
        </StorySection>
      )}

      {finishedStories.length > 0 && (
        <StorySection title="Finished" count={finishedStories.length}>
          {finishedStories.map((story) => card(story, finishedFoot(story.chapters.length, story.words)))}
        </StorySection>
      )}

      {!stories.length && (
        <p className="muted">You&rsquo;re not in any stories yet. Start one, or ask a friend for an Invite.</p>
      )}

      <details id="new" className={styles.new} open={Boolean(wantsNew) || !stories.length}>
        <summary className="button">New Story</summary>
        <div className={styles.newBody}>
          <h2>Start a story</h2>
          <p className="muted">You&rsquo;ll be its Host. You can invite Writers once it&rsquo;s created.</p>
          <ActionForm action={createStory} className={styles.form}>
            <StoryFields />
            <div>
              <button className="button button-primary">Create story</button>
            </div>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
