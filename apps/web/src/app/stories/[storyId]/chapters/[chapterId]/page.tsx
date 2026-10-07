import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getChapters, getStory, liveWriter, storyAuthors } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { canManageChapters } from "@/lib/story-roles";
import { setChapterLocked } from "@/lib/actions/chapters";
import { ActionForm } from "@/components/ActionForm";
import { LiveDocument } from "@/components/LiveDocument";
import styles from "./chapter.module.css";

async function load(storyId: string, chapterId: string) {
  const data = await getStory(storyId);
  if (!data) return null;
  const chapters = await getChapters(storyId);
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index < 0) return null;
  return { ...data, chapters, index, chapter: chapters[index]! };
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
  const { story, chapters, index, chapter, myRole } = data;
  const prev = chapters[index - 1];
  const next = chapters[index + 1];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/stories/${story.id}`} className="muted">
          &larr; {story.title}
        </Link>
        <div className={styles.meta}>
          <span className="muted">
            Chapter {index + 1} of {chapters.length}
          </span>
          {chapter.locked && <span className="pill">Locked</span>}
          {canManageChapters(myRole) && story.status !== "finished" && (
            <ActionForm action={setChapterLocked.bind(null, story.id, chapter.id, !chapter.locked)}>
              <button className="button button-small">{chapter.locked ? "Unlock" : "Lock"}</button>
            </ActionForm>
          )}
        </div>
        <h1 className={styles.title}>{chapter.title}</h1>
      </header>

      <LiveDocument
        key={chapter.id}
        kind="chapter"
        id={chapter.id}
        writer={liveWriter(data)}
        authors={storyAuthors(data)}
      />

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
