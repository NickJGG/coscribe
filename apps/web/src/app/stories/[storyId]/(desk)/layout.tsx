import Link from "next/link";
import { getChapters, getEntries, getStory } from "@/lib/story";
import { canManageChapters, canManageInvites } from "@/lib/story-roles";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX } from "@/lib/entries";
import { addChapter } from "@/lib/actions/chapters";
import { addEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { AccountMenus } from "@/components/SiteHeader";
import { LiveStatusProvider } from "@/components/LiveStatus";
import { SignInLink } from "@/components/SignInLink";
import { SyncSocketProvider } from "@/components/SyncSocket";
import { DeskFrame } from "./DeskFrame";
import { Breadcrumb, DeskStatus } from "./DeskHeader";
import { DeskFooter, DeskMain } from "./DeskMain";
import { Sidebar } from "./Sidebar";
import styles from "./desk.module.css";

/**
 * The desk: Chapter and Entry pages beside one sidebar, over one sync connection for the Story. Layouts
 * don't re-render between sibling pages, so the socket, sidebar scroll and collapsed state carry over.
 */
export default async function DeskLayout(props: LayoutProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);
  // The page decides between sign in and not found.
  if (!data) return props.children;

  const { story, myRole, viewer } = data;
  const [chapters, entries] = await Promise.all([getChapters(story.id), getEntries(story.id)]);
  const writable = myRole && story.status !== "finished";

  return (
    <SyncSocketProvider>
      <LiveStatusProvider>
        <DeskFrame className={styles.desk}>
          <header className={styles.header}>
            <Link href={viewer?.profile ? "/stories" : "/"} className={styles.wordmark}>
              Coscribe
            </Link>
            <Breadcrumb storyId={story.id} storyTitle={story.title} chapters={chapters} entries={entries} />
            <div className={styles.end}>
              <DeskStatus member={!!myRole} />
              {canManageInvites(myRole) && (
                <Link href={`/stories/${story.id}/settings#invites`} className={`button button-small ${styles.invite}`}>
                  Invite
                </Link>
              )}
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
            <DeskMain footer={<DeskFooter signedOut={!viewer} />}>{props.children}</DeskMain>
          </div>
        </DeskFrame>
      </LiveStatusProvider>
    </SyncSocketProvider>
  );
}
