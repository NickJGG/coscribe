import Link from "next/link";
import { cookies } from "next/headers";
import { getChapters, getEntries, getPins, getStory } from "@/lib/story";
import { canDeleteEntries, canManageChapters, canManageInvites, isWriter } from "@/lib/story-roles";
import { moveTargets } from "@/lib/chapter-order";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, entryGroups, NAME_MAX } from "@/lib/entries";
import { COLLAPSED_COOKIE, parseCollapsed, parseSidebarWidth, WIDTH_COOKIE } from "@/lib/desk-sidebar";
import { addChapter } from "@/lib/actions/chapters";
import { addEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { AccountMenus } from "@/components/SiteHeader";
import { LiveStatusProvider } from "@/components/LiveStatus";
import { PinnedEntriesProvider } from "@/components/PinnedEntries";
import { SignInLink } from "@/components/SignInLink";
import { ChatButton } from "@/components/StoryPanel";
import { StorySearchProvider } from "@/components/StorySearch";
import { SyncSocketProvider } from "@/components/SyncSocket";
import { Wordmark } from "@/components/Wordmark";
import { ChapterMenu } from "./ChapterMenu";
import { DeskFrame } from "./DeskFrame";
import { Breadcrumb, DeskStatus } from "./DeskHeader";
import { DeskFooter, DeskMain } from "./DeskMain";
import { EntryMenu } from "./EntryMenu";
import { EntryTypeMenu } from "./EntryTypeMenu";
import { Sidebar } from "./Sidebar";
import styles from "./desk.module.css";

/**
 * The desk: the Overview, Settings, Search, Chapter and Entry pages beside one sidebar, over one sync connection
 * for the Story. Layouts don't re-render between sibling pages, so the socket, sidebar scroll and
 * collapsed state carry over.
 */
export default async function DeskLayout(props: LayoutProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);
  // The page decides between sign in and not found.
  if (!data) return props.children;

  const { story, myRole, viewer } = data;
  const [chapters, entries, pins, cookieStore] = await Promise.all([
    getChapters(story.id),
    getEntries(story.id),
    getPins(story.id),
    cookies(),
  ]);
  const writer = isWriter(myRole);
  const writable = writer && story.status !== "finished";
  const storyWords = chapters.reduce((sum, c) => sum + c.word_count, 0);
  const reorderable = !!writable && canManageChapters(myRole);
  const chapterIds = chapters.map((c) => c.id);
  // Rendered here so the menus' Server Actions are bound on the server.
  const chapterMenus = reorderable
    ? Object.fromEntries(
        chapters.map((chapter, i) => {
          const { up, down } = moveTargets(chapterIds, i);
          return [
            chapter.id,
            <ChapterMenu
              key={chapter.id}
              storyId={story.id}
              chapter={chapter}
              upAfter={up}
              downAfter={down}
              only={chapters.length === 1}
            />,
          ];
        })
      )
    : undefined;
  const groups = entryGroups(entries, story.entry_type_order);
  const entryMenus = writable
    ? Object.fromEntries(
        groups.flatMap(({ entries: group }) => {
          const ids = group.map((e) => e.id);
          return group.map((entry, i) => {
            const { up, down } = reorderable ? moveTargets(ids, i) : {};
            return [
              entry.id,
              <EntryMenu
                key={entry.id}
                storyId={story.id}
                entry={entry}
                upAfter={up}
                downAfter={down}
                deletable={canDeleteEntries(myRole)}
              />,
            ];
          });
        })
      )
    : undefined;
  const types = groups.map((g) => g.type);
  const typeMenus =
    reorderable && types.length > 1
      ? Object.fromEntries(
          types.map((type, i) => {
            const { up, down } = moveTargets(types, i);
            return [type, <EntryTypeMenu key={type} storyId={story.id} type={type} upAfter={up} downAfter={down} />];
          })
        )
      : undefined;

  return (
    <SyncSocketProvider>
      <LiveStatusProvider>
        <DeskFrame
          className={styles.desk}
          initialWidth={parseSidebarWidth(cookieStore.get(WIDTH_COOKIE)?.value)}
          initialCollapsed={parseCollapsed(cookieStore.get(COLLAPSED_COOKIE)?.value)}
        >
          <StorySearchProvider storyId={story.id}>
            <header className={styles.header}>
              <Link href={viewer?.profile ? "/stories" : "/"} className={styles.wordmark}>
                <Wordmark />
              </Link>
              <Breadcrumb storyId={story.id} storyTitle={story.title} chapters={chapters} entries={entries} />
              <div className={styles.end}>
                <DeskStatus member={writer} />
                {canManageInvites(myRole) && (
                  <Link href={`/stories/${story.id}/settings/writers`} className={`button button-small ${styles.invite}`}>
                    Invite
                  </Link>
                )}
                {writer && <ChatButton className="button button-small" />}
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
  
            <PinnedEntriesProvider storyId={story.id} initialIds={pins} canPin={!!myRole}>
              <div className={styles.body}>
                <Sidebar
                  storyId={story.id}
                  storyTitle={story.title}
                  chapters={chapters}
                  entries={entries}
                  typeOrder={story.entry_type_order}
                  member={!!myRole}
                  reorderable={reorderable}
                  chapterMenus={chapterMenus}
                  entryMenus={entryMenus}
                  typeMenus={typeMenus}
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
                <DeskMain footer={<DeskFooter member={writer} signedOut={!viewer} storyWords={storyWords} />}>{props.children}</DeskMain>
              </div>
            </PinnedEntriesProvider>
          </StorySearchProvider>
        </DeskFrame>
      </LiveStatusProvider>
    </SyncSocketProvider>
  );
}
