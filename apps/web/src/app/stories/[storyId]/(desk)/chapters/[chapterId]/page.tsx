import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getChapters, getEntries, getOutlineHasContent, getStory, liveWriter, storyAuthors } from "@/lib/story";
import { entryMentionEntries } from "@/lib/entries";
import { getViewer } from "@/lib/viewer";
import { canManageChapters, isWriter } from "@/lib/story-roles";
import { resolveToolbarLayout } from "@/lib/toolbar-layout";
import { setChapterLocked } from "@/lib/actions/chapters";
import { ActionForm } from "@/components/ActionForm";
import { LockIcon } from "@/components/icons";
import { LiveDocument } from "@/components/LiveDocument";
import { trashedDocument } from "@/components/TrashedDocument";
import { SnapshotCompareProvider } from "@/components/SnapshotCompare";
import { SnapshotCompareView } from "@/components/SnapshotCompareView";
import { SnapshotButton } from "@/components/SnapshotButton";
import { SnapshotHistory } from "@/components/SnapshotHistory";
import { NotesProvider } from "@/components/notes/NotesProvider";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { PinnedColumn } from "@/components/PinnedColumn";
import { OutlineButton } from "@/components/outline/OutlineButton";
import { ChapterTitle } from "./ChapterTitle";
import styles from "./chapter.module.css";

async function load(storyId: string, chapterId: string) {
  const data = await getStory(storyId);
  if (!data) return null;
  const [chapters, entries] = await Promise.all([getChapters(storyId), getEntries(storyId)]);
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index < 0) return null;
  return { ...data, chapters, entries, index, chapter: chapters[index]! };
}

export async function generateMetadata(props: PageProps<"/stories/[storyId]/chapters/[chapterId]">): Promise<Metadata> {
  const { storyId, chapterId } = await props.params;
  const data = await load(storyId, chapterId);
  return { title: data ? `${data.chapter.title} · ${data.story.title}` : "Chapter" };
}

export default async function ChapterPage(props: PageProps<"/stories/[storyId]/chapters/[chapterId]">) {
  const { storyId, chapterId } = await props.params;
  const data = await load(storyId, chapterId);
  if (!data) {
    const trashed = await trashedDocument(storyId, "chapter", chapterId);
    if (trashed) return trashed;
    if (!(await getViewer())) {
      redirect(`/login?next=${encodeURIComponent(`/stories/${storyId}/chapters/${chapterId}`)}`);
    }
    notFound();
  }
  const { story, chapters, entries, index, chapter, myRole } = data;
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const authors = storyAuthors(data);
  const manage = canManageChapters(myRole) && story.status !== "finished";
  const writer = liveWriter(data);
  const mentionEntries = entryMentionEntries(entries);
  const [viewer, outlined] = await Promise.all([
    getViewer(),
    isWriter(myRole) && getOutlineHasContent(chapter.id),
  ]);

  const live = (
    <LiveDocument
      key={chapter.id}
      kind="chapter"
      id={chapter.id}
      writer={writer}
      authors={authors}
      entryMentions={{ storyId: story.id, entries: mentionEntries }}
      toolbarLayout={resolveToolbarLayout(viewer?.profile?.toolbar_layout)}
      outline={
        isWriter(myRole) && (
          <OutlineButton
            storyId={story.id}
            chapterId={chapter.id}
            eyebrow={`Chapter ${index + 1} · ${chapter.title}`}
            characters={mentionEntries.filter((e) => e.type === "character")}
            entryEditable={story.status !== "finished"}
            writer={writer}
            authors={authors}
            hasContent={outlined}
          />
        )
      }
      tools={
        manage && (
          <>
            <SnapshotButton chapterId={chapter.id} />
            <ActionForm action={setChapterLocked.bind(null, story.id, chapter.id, !chapter.locked)}>
              <button
                className="button button-ghost button-tiny with-icon"
                data-tip={chapter.locked ? "Unlock this Chapter" : "Lock this Chapter"}
              >
                <LockIcon open={chapter.locked} />
                <span className="with-icon-label">{chapter.locked ? "Unlock" : "Lock"}</span>
              </button>
            </ActionForm>
          </>
        )
      }
    />
  );

  const text =
    myRole && writer ? (
      <NotesProvider
        key={chapter.id}
        chapterId={chapter.id}
        me={writer.userId}
        myRole={myRole}
        authors={authors}
        finished={story.status === "finished"}
      >
        {live}
        <NotesPanel />
      </NotesProvider>
    ) : (
      live
    );

  return (
    <div className={styles.page}>
      <PinnedColumn storyId={story.id} entries={mentionEntries} writer={writer} authors={authors} />
      <header className={styles.header}>
        <div className={styles.meta}>
          <span className="smallcaps">Chapter {index + 1}</span>
          {chapter.locked && <span className="pill">Locked</span>}
          {story.status === "finished" && (
            <Link href={`/stories/${story.id}/read/${chapter.id}`} className="button button-small">
              Reader View
            </Link>
          )}
        </div>
        <ChapterTitle key={chapter.id} storyId={story.id} chapterId={chapter.id} title={chapter.title} renamable={manage} />
      </header>

      {canManageChapters(myRole) ? (
        <SnapshotCompareProvider key={chapter.id} chapterId={chapter.id}>
          {text}
          <SnapshotCompareView authors={authors} canRestore={story.status !== "finished"} canName={canManageChapters(myRole)} />
          <SnapshotHistory chapterId={chapter.id} chapterTitle={chapter.title} />
        </SnapshotCompareProvider>
      ) : (
        text
      )}

      <nav className={styles.pager} aria-label="Chapters">
        {prev ? (
          <Link href={`/stories/${story.id}/chapters/${prev.id}`} className="button">
            &larr; {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/stories/${story.id}/chapters/${next.id}`} className="button">
            {next.title} &rarr;
          </Link>
        )}
      </nav>
    </div>
  );
}
