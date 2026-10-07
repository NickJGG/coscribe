import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChapters, getEntries, getStory } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { byJoinOrder } from "@/lib/contribution";
import type { MemberRole } from "@/lib/story-roles";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX } from "@/lib/entries";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { addChapter } from "@/lib/actions/chapters";
import { addEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { AvatarStack } from "@/components/Avatar";
import { BibleList } from "./BibleList";
import { ChapterList } from "./ChapterList";
import styles from "./story.module.css";

const YOU: Record<MemberRole, string> = { host: "You host", cohost: "You co-host", writer: "You write" };

export async function generateMetadata(props: PageProps<"/stories/[storyId]">): Promise<Metadata> {
  const data = await getStory((await props.params).storyId);
  return { title: data?.story.title ?? "Story" };
}

export default async function StoryPage(props: PageProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);
  if (!data) {
    // Private stories look missing to everyone outside them; a signed-out member just needs to sign in.
    if (!(await getViewer())) redirect(`/login?next=${encodeURIComponent(`/stories/${storyId}`)}`);
    notFound();
  }
  const { story, myRole, viewer } = data;

  const supabase = await createClient();
  const [chapters, entries] = await Promise.all([getChapters(story.id), getEntries(story.id)]);
  const finished = story.status === "finished";
  const { data: invite } =
    viewer && !myRole
      ? await supabase
          .from("invites")
          .select("id")
          .eq("story_id", story.id)
          .eq("invitee_id", viewer.userId)
          .is("used_at", null)
          .maybeSingle()
      : { data: null };

  const members = data.members
    .map((m) => ({ ...m.profile, name: m.profile.username, color: m.profile.author_color, role: m.role, joinedAt: m.joined_at }))
    .sort(byJoinOrder);
  const words = chapters.reduce((sum, c) => sum + c.word_count, 0);
  const meta = [
    story.visibility === "public" ? "Public story" : "Private story",
    myRole && YOU[myRole],
    finished && "Finished",
  ].filter(Boolean);
  const primary = primaryAction(story.id, chapters, myRole, finished);

  return (
    <div className={styles.page}>
      {invite && (
        <div className={styles.invite}>
          <span>You&rsquo;ve been invited to write in this story.</span>
          <span className="row-actions">
            <ActionForm action={deleteInvite.bind(null, invite.id)}>
              <button className="button button-ghost button-small">Decline</button>
            </ActionForm>
            <ActionForm action={acceptInvite.bind(null, invite.id)}>
              <button className="button button-primary button-small">Join as Writer</button>
            </ActionForm>
          </span>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.heading}>
          <span className="smallcaps">{meta.join(" · ")}</span>
          <h1 className={styles.title}>{story.title}</h1>
          <span className={styles.byline}>
            <AvatarStack people={members} />
            <span>
              {members.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && (i === members.length - 1 ? " and " : ", ")}
                  <Link href={`/u/${m.username}`}>{m.username}</Link>
                </span>
              ))}{" "}
              · <span className={styles.tnum}>{words.toLocaleString("en-US")}</span> {words === 1 ? "word" : "words"}
            </span>
          </span>
        </div>
        <div className="row-actions">
          {myRole && (
            <Link href={`/stories/${story.id}/settings`} className="button button-ghost">
              Settings
            </Link>
          )}
          {finished && (
            <Link href={`/stories/${story.id}/read/credits`} className="button">
              Credits
            </Link>
          )}
          {primary && (
            <Link href={primary.href} className="button button-primary">
              {primary.label}
            </Link>
          )}
        </div>
      </header>

      <div className={styles.columns}>
        <section>
          <div className={styles.sectionHead}>
            <h2 className="smallcaps">Chapters</h2>
            {myRole && !finished && (
              <ActionForm action={addChapter.bind(null, story.id)}>
                <input type="hidden" name="title" value={`Chapter ${chapters.length + 1}`} />
                <button className={styles.headAction}>+ New Chapter</button>
              </ActionForm>
            )}
          </div>
          <ChapterList storyId={story.id} chapters={chapters} myRole={myRole} finished={finished} />
        </section>

        <section>
          <div className={styles.sectionHead}>
            <h2 className="smallcaps">Story Bible</h2>
            <span>
              {entries.length} {entries.length === 1 ? "Entry" : "Entries"}
            </span>
          </div>
          <BibleList storyId={story.id} entries={entries} />
          {myRole && !finished && (
            <details className={styles.addEntry}>
              <summary className={styles.headAction}>+ Add Entry</summary>
              <ActionForm action={addEntry.bind(null, story.id)} className={styles.inlineForm}>
                <select name="type" className="input" aria-label="New Entry type" defaultValue="character">
                  {ENTRY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {ENTRY_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <input
                  name="name"
                  className="input"
                  placeholder="Name"
                  maxLength={NAME_MAX}
                  required
                  aria-label="New Entry name"
                />
                <button className="button button-small">Add Entry</button>
              </ActionForm>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}

/** Finished stories open the Reader; otherwise the most recently edited Chapter, to write in or watch. */
function primaryAction(
  storyId: string,
  chapters: { id: string; edited_at: string | null }[],
  myRole: MemberRole | null,
  finished: boolean
): { href: string; label: string } | null {
  if (finished) return { href: `/stories/${storyId}/read`, label: "Read the story" };
  if (!chapters.length) return null;
  const latest = chapters.reduce((best, c) => ((c.edited_at ?? "") > (best.edited_at ?? "") ? c : best));
  const n = chapters.indexOf(latest) + 1;
  return {
    href: `/stories/${storyId}/chapters/${latest.id}`,
    label: myRole ? `Continue Chapter ${n}` : `Watch Chapter ${n} live`,
  };
}
