import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formerWriterNames, getChapters, getEntries, getStory, getTrash } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { byJoinOrder, readAuthorChars, storyRibbon } from "@/lib/contribution";
import { monthYear, recentlyEdited } from "@/lib/overview";
import { relativeTime } from "@/lib/relative-time";
import { parseTrashed } from "@/lib/trash";
import { isWriter, ROLE_LABEL, type MemberRole } from "@/lib/story-roles";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { restoreChapter } from "@/lib/actions/chapters";
import { restoreEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { Avatar, AvatarStack } from "@/components/Avatar";
import { ContributionRibbon } from "@/components/ContributionRibbon";
import { ExportMenu } from "@/components/ExportMenu";
import { ChapterPresence } from "@/components/StoryPresence";
import { TrashUndo } from "@/components/TrashUndo";
import { BrowseButton, HereDot, WritingNow } from "./Overview";
import { readingTime } from "@/lib/words";
import styles from "./overview.module.css";

const YOU: Record<MemberRole, string> = {
  host: "You host",
  cohost: "You co-host",
  writer: "You write",
  viewer: "You're reading",
};

export async function generateMetadata(props: PageProps<"/stories/[storyId]">): Promise<Metadata> {
  const data = await getStory((await props.params).storyId);
  return { title: data?.story.title ?? "Story", description: data?.story.blurb ?? undefined };
}

/** The Story's Overview: who's writing now, what changed lately, and who writes it. */
export default async function OverviewPage(props: PageProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);
  if (!data) {
    // Private stories look missing to everyone outside them; a signed-out member just needs to sign in.
    if (!(await getViewer())) redirect(`/login?next=${encodeURIComponent(`/stories/${storyId}`)}`);
    notFound();
  }
  const { story, myRole, viewer } = data;

  const supabase = await createClient();
  const [chapters, entries, { data: chars }, { data: invite }] = await Promise.all([
    getChapters(story.id),
    getEntries(story.id),
    supabase.from("chapters").select("author_chars").eq("story_id", story.id),
    viewer && !myRole
      ? supabase
          .from("invites")
          .select("id, role")
          .eq("story_id", story.id)
          .eq("invitee_id", viewer.userId)
          .is("used_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const finished = story.status === "finished";
  const canExport = finished || isWriter(myRole);

  const members = data.members
    .map((m) => ({
      ...m.profile,
      name: m.profile.username,
      color: m.profile.author_color,
      role: m.role,
      joinedAt: m.joined_at,
    }))
    .sort(byJoinOrder);
  const authorChars = (chars ?? []).map((c) => readAuthorChars(c.author_chars));
  const memberIds = new Set(members.map((m) => m.id));
  const formerNames = await formerWriterNames(authorChars.flatMap(Object.keys).filter((id) => !memberIds.has(id)));
  const ribbon = storyRibbon(members, authorChars, formerNames);

  const words = chapters.reduce((sum, c) => sum + c.word_count, 0);
  const time = finished && readingTime(words);
  const meta = [
    story.visibility === "public" ? "Public story" : "Private story",
    myRole && YOU[myRole],
    finished && "Finished",
    `Started ${monthYear(story.created_at)}`,
  ].filter(Boolean);
  const primary = primaryAction(story.id, chapters, myRole, finished);
  const recent = finished ? [] : recentlyEdited(chapters);
  const trashed = parseTrashed((await props.searchParams).trashed);
  // Only the deleter can Undo, and only while it's still in the Trash.
  const undoable =
    trashed &&
    viewer &&
    (await getTrash(story.id)).find((t) => t.kind === trashed.kind && t.id === trashed.id && t.deleted_by === viewer.userId);

  return (
    <div className={styles.page}>
      {invite && (
        <div className={styles.invite}>
          <span>You&rsquo;ve been invited to {invite.role === "viewer" ? "read" : "write in"} this story.</span>
          <span className="row-actions">
            <ActionForm action={deleteInvite.bind(null, invite.id)}>
              <button className="button button-ghost button-small">Decline</button>
            </ActionForm>
            <ActionForm action={acceptInvite.bind(null, invite.id)}>
              <button className="button button-primary button-small">
                {invite.role === "viewer" ? "Join as Viewer" : "Join as Writer"}
              </button>
            </ActionForm>
          </span>
        </div>
      )}

      <header className={styles.heading}>
        <span className="smallcaps">{meta.join(" · ")}</span>
        <h1 className={styles.title}>{story.title}</h1>
        {story.blurb ? (
          <p className={styles.blurb}>{story.blurb}</p>
        ) : (
          myRole === "host" && (
            <Link href={`/stories/${story.id}/settings/story`} className={styles.addBlurb}>
              Add a blurb
            </Link>
          )
        )}
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
            {time && ` · ${time} read`}
          </span>
        </span>
        {(primary || canExport) && (
          <div className={`row-actions ${styles.actions}`}>
            {primary && (
              <Link href={primary.href} className="button button-primary">
                {primary.label}
              </Link>
            )}
            {finished && (
              <Link href={`/stories/${story.id}/read/credits`} className="button">
                Credits
              </Link>
            )}
            {canExport && <ExportMenu storyId={story.id} finished={finished} hasEntries={entries.length > 0} />}
          </div>
        )}
      </header>

      <BrowseButton />

      <div className={styles.columns}>
        <div className={styles.lead}>
          {!finished && (
            <WritingNow
              storyId={story.id}
              chapters={chapters.map(({ id, title }) => ({ id, title }))}
              entries={entries.map(({ id, name }) => ({ id, name }))}
              member={isWriter(myRole)}
            />
          )}
          {recent.length > 0 && (
            <section className={styles.section} aria-labelledby="overview-recent">
              <h2 id="overview-recent" className="smallcaps">
                Recently edited
              </h2>
              <ol className={styles.chapters}>
                {recent.map(({ chapter, number }) => (
                  <li key={chapter.id} className={styles.chapter}>
                    <span className={styles.chapterNumber}>{number}</span>
                    <Link href={`/stories/${story.id}/chapters/${chapter.id}`} className={styles.chapterTitle}>
                      {chapter.title}
                    </Link>
                    <ChapterPresence chapterId={chapter.id} className={styles.chapterDots} />
                    <span className={styles.chapterSub}>
                      <span className={styles.tnum}>{chapter.word_count.toLocaleString("en-US")}</span>{" "}
                      {chapter.word_count === 1 ? "word" : "words"} · edited{" "}
                      {relativeTime(Date.parse(chapter.edited_at!))}
                      {chapter.locked && " · Locked"}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <section className={`${styles.section} ${styles.side}`} aria-labelledby="overview-writers">
          <h2 id="overview-writers" className="smallcaps">
            Writers
          </h2>
          <ContributionRibbon segments={ribbon} />
          <ul className={styles.writers}>
            {members.map((m) => (
              <li key={m.id} className={styles.writer}>
                <Avatar name={m.name} color={m.color} />
                <span className={styles.writerText}>
                  <Link href={`/u/${m.username}`}>{m.username}</Link>
                  <span>{ROLE_LABEL[m.role]}</span>
                </span>
                <HereDot userId={m.id} />
              </li>
            ))}
          </ul>
        </section>
      </div>
      {undoable && (
        <TrashUndo
          key={undoable.id}
          title={undoable.title}
          undo={(undoable.kind === "chapter" ? restoreChapter : restoreEntry).bind(null, story.id, undoable.id, true)}
        />
      )}
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
    label: isWriter(myRole) ? `Continue Chapter ${n}` : `Watch Chapter ${n} live`,
  };
}
