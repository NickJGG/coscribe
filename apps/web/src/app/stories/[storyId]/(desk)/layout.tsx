import Link from "next/link";
import { getChapters, getEntries, getStory } from "@/lib/story";
import { canDeleteEntries, canManageChapters, canManageInvites } from "@/lib/story-roles";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX } from "@/lib/entries";
import { addChapter } from "@/lib/actions/chapters";
import { addEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { AccountMenus } from "@/components/SiteHeader";
import { LiveStatusProvider } from "@/components/LiveStatus";
import { SignInLink } from "@/components/SignInLink";
import { ChatButton } from "@/components/StoryPanel";
import { SyncSocketProvider } from "@/components/SyncSocket";
import { Wordmark } from "@/components/Wordmark";
import { ChapterMenu } from "./ChapterMenu";
import { DeskFrame } from "./DeskFrame";
import { Breadcrumb, DeskStatus } from "./DeskHeader";
import { DeskFooter, DeskMain } from "./DeskMain";
import { EntryMenu } from "./EntryMenu";
import { Sidebar } from "./Sidebar";
import styles from "./desk.module.css";

/**
 * The desk: the Overview, Settings, Chapter and Entry pages beside one sidebar, over one sync connection
 * for the Story. Layouts don't re-render between sibling pages, so the socket, sidebar scroll and
 * collapsed state carry over.
 */
export default async function DeskLayout(props: LayoutProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);
  // The page decides between sign in and not found.
  if (!data) return props.children;

  const { story, myRole, viewer } = data;
  const [chapters, entries] = await Promise.all([getChapters(story.id), getEntries(story.id)]);
  const writable = myRole && story.status !== "finished";
  const storyWords = chapters.reduce((sum, c) => sum + c.word_count, 0);
  // Rendered here so the menus' Server Actions are bound on the server.
  const chapterMenus =
    writable && canManageChapters(myRole)
      ? Object.fromEntries(
          chapters.map((chapter, i) => [
            chapter.id,
            <ChapterMenu
              key={chapter.id}
              storyId={story.id}
              chapter={chapter}
              first={i === 0}
              last={i === chapters.length - 1}
              only={chapters.length === 1}
            />,
          ])
        )
      : undefined;
  const entryMenus = writable
    ? Object.fromEntries(
        entries.map((entry) => [
          entry.id,
          <EntryMenu key={entry.id} storyId={story.id} entry={entry} deletable={canDeleteEntries(myRole)} />,
        ])
      )
    : undefined;

  return (
    <SyncSocketProvider>
      <LiveStatusProvider>
        <DeskFrame className={styles.desk}>
          <header className={styles.header}>
            <Link href={viewer?.profile ? "/stories" : "/"} className={styles.wordmark}>
              <Wordmark />
            </Link>
            <Breadcrumb storyId={story.id} storyTitle={story.title} chapters={chapters} entries={entries} />
            <div className={styles.end}>
              <DeskStatus member={!!myRole} />
              {canManageInvites(myRole) && (
                <Link href={`/stories/${story.id}/settings#invites`} className={`button button-small ${styles.invite}`}>
                  Invite
                </Link>
              )}
              {myRole && <ChatButton className="button button-small" />}
              {viewer?.profile ? (
                <AccountMenus profile={viewer.profile} />
              ) : viewer ? (
                <Link href="/onboarding" className="button button-primary button-small">
                  Finish sign-up
                </Link>
              ) : (
                <SignInLink className="button button-ghost button-small" />
              )}
            </div>
          </header>

          <div className={styles.body}>
            <Sidebar
              storyId={story.id}
              storyTitle={story.title}
              chapters={chapters}
              entries={entries}
              member={!!myRole}
              chapterMenus={chapterMenus}
              entryMenus={entryMenus}
              newChapter={
                writable &&
                canManageChapters(myRole) && (
                  <ActionForm action={addChapter.bind(null, story.id)}>
                    <input type="hidden" name="title" value={`Chapter ${chapters.length + 1}`} />
                    <button className={styles.add}>+ New Chapter</button>
                  </ActionForm>
                )
              }
              newEntry={
                writable && (
                  <details className={styles.addEntry}>
                    <summary className={styles.add}>+ Add Entry</summary>
                    <ActionForm action={addEntry.bind(null, story.id)} className={styles.addForm}>
                      <select name="type" className="input" aria-label="New Entry type" defaultValue="character">
                        {ENTRY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {ENTRY_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </select>
                      <input name="name" className="input" placeholder="Name" maxLength={NAME_MAX} required />
                      <button className="button button-small">Add</button>
                    </ActionForm>
                  </details>
                )
              }
            />
            <DeskMain footer={<DeskFooter member={!!myRole} signedOut={!viewer} storyWords={storyWords} />}>{props.children}</DeskMain>
          </div>
        </DeskFrame>
      </LiveStatusProvider>
    </SyncSocketProvider>
  );
}
