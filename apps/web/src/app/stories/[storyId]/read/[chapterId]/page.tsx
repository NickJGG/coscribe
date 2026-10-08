import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChapters, getStory } from "@/lib/story";
import { requireReader } from "@/lib/reader";
import { ProseView } from "@/components/ProseView";
import { ShowAuthors } from "@/components/ShowAuthors";
import { Unavailable } from "../Unavailable";
import styles from "../reader.module.css";

export async function generateMetadata(props: PageProps<"/stories/[storyId]/read/[chapterId]">): Promise<Metadata> {
  const { storyId, chapterId } = await props.params;
  const [data, chapters] = await Promise.all([getStory(storyId), getChapters(storyId)]);
  const chapter = chapters.find((c) => c.id === chapterId);
  return { title: data && chapter ? `${chapter.title} · ${data.story.title}` : "Chapter" };
}

export default async function ReaderChapterPage(props: PageProps<"/stories/[storyId]/read/[chapterId]">) {
  const { storyId, chapterId } = await props.params;
  const { story, chapters, content, authors } = await requireReader(
    storyId,
    `/stories/${storyId}/read/${chapterId}`
  );
  const index = chapters.findIndex((c) => c.id === chapterId);
  if (index < 0) notFound();
  const chapter = chapters[index]!;
  const prev = chapters[index - 1];
  const next = chapters[index + 1];
  const text = content?.chapter[chapter.id];
  const base = `/stories/${story.id}/read`;

  return (
    <div className={styles.page}>
      <header className={styles.chapterHead}>
        <p className={styles.eyebrow}>Chapter {index + 1}</p>
        <h1 className={styles.chapterTitle}>{chapter.title}</h1>
      </header>

      {!content ? (
        <Unavailable />
      ) : text?.content?.length ? (
        <div>
          <ShowAuthors authors={authors} toggleClassName={styles.tools}>
            <div className={styles.text}>
              <ProseView content={text} />
            </div>
          </ShowAuthors>
        </div>
      ) : (
        <p className={styles.empty}>This Chapter was left blank.</p>
      )}

      <nav className={styles.pager} aria-label="Chapters">
        {prev ? (
          <Link href={`${base}/${prev.id}`} className="button">
            &larr; {prev.title}
          </Link>
        ) : (
          <Link href={base} className="button">
            &larr; Contents
          </Link>
        )}
        {next ? (
          <Link href={`${base}/${next.id}`} className="button">
            {next.title} &rarr;
          </Link>
        ) : (
          <Link href={`${base}/credits`} className="button">
            Credits &rarr;
          </Link>
        )}
      </nav>
    </div>
  );
}
