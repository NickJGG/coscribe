import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getChapters, getEntries, getStory, liveWriter, storyAuthors } from "@/lib/story";
import { mentionEntries } from "@/lib/entries";
import { getViewer } from "@/lib/viewer";
import { canManageChapters } from "@/lib/story-roles";
import { setChapterLocked } from "@/lib/actions/chapters";
import { ActionForm } from "@/components/ActionForm";
import { LiveDocument } from "@/components/LiveDocument";
import { SnapshotHistory } from "@/components/SnapshotHistory";
import { NotesProvider } from "@/components/notes/NotesProvider";
import { NotesPanel } from "@/components/notes/NotesPanel";
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

  const live = (
    <LiveDocument
      key={chapter.id}
      kind="chapter"
      id={chapter.id}
      writer={writer}
      authors={authors}
      mentions={{ storyId: story.id, entries: mentionEntries(entries) }}
      tools={
        manage && (
          <ActionForm action={setChapterLocked.bind(null, story.id, chapter.id, !chapter.locked)}>
            <button className="button button-ghost button-tiny">{chapter.locked ? "Unlock" : "Lock"}</button>
          </ActionForm>
        )
      }
    />
  );

  return (
    <div className={styles.page}>
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

      {myRole && writer ? (
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
      )}

      {canManageChapters(myRole) && (
        <SnapshotHistory
          key={chapter.id}
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          authors={authors}
          canRestore={story.status !== "finished"}
          canName={myRole === "host"}
        />
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
