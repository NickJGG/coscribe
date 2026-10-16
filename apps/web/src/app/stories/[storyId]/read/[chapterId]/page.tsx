import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChapters, getStory } from "@/lib/story";
import { requireReader } from "@/lib/reader";
import { isWriter } from "@/lib/story-roles";
import { BackToTop } from "@/components/BackToTop";
import { ProseView } from "@/components/ProseView";
import { ShowAuthors } from "@/components/ShowAuthors";
import { FeaturePassage } from "@/components/FeaturePassage";
import { ReaderListen } from "@/components/narration/ReaderListen";
import { readingTime } from "@/lib/words";
import { entryMentionEntries } from "@/lib/entries";
import { Unavailable } from "../Unavailable";
import scriptStyles from "@/components/Script.module.css";
import styles from "../reader.module.css";

const TEXT_ID = "chapter-text";

export async function generateMetadata(props: PageProps<"/stories/[storyId]/read/[chapterId]">): Promise<Metadata> {
  const { storyId, chapterId } = await props.params;
  const [data, chapters] = await Promise.all([getStory(storyId), getChapters(storyId)]);
  const chapter = chapters.find((c) => c.id === chapterId);
  return { title: data && chapter ? `${chapter.title} · ${data.story.title}` : "Chapter" };
}

export default async function ReaderChapterPage(props: PageProps<"/stories/[storyId]/read/[chapterId]">) {
  const { storyId, chapterId } = await props.params;
  const { story, chapters, entries, content, authors, myRole, viewer } = await requireReader(
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
  const time = readingTime(chapter.word_count);
  // Narration skips blank Chapters, which have nothing to read.
  const nextRead = chapters.slice(index + 1).find((c) => content?.chapter[c.id]?.content?.length);

  return (
    <div className={styles.page}>
      <header className={styles.chapterHead}>
        <p className={styles.eyebrow}>
          Chapter {index + 1}
          {time && ` · ${time} read`}
        </p>
        <h1 className={styles.chapterTitle}>{chapter.title}</h1>
      </header>

      {!content ? (
        <Unavailable />
      ) : text?.content?.length ? (
        <div>
          <ShowAuthors
            authors={authors}
            toggleClassName={styles.tools}
            tools={
              <ReaderListen
                storyId={story.id}
                content={text}
                number={index + 1}
                title={chapter.title}
                characters={entryMentionEntries(entries).filter((e) => e.type === "character")}
                next={nextRead ? `${base}/${nextRead.id}` : null}
                credits={`${base}/credits`}
                textId={TEXT_ID}
              />
            }
          >
            <div id={TEXT_ID} className={`${styles.text} ${scriptStyles.scripts}`}>
              {isWriter(myRole) && viewer?.profile ? (
                <FeaturePassage
                  storyId={story.id}
                  chapterId={chapter.id}
                  userId={viewer.userId}
                  username={viewer.profile.username}
                  content={text}
                >
                  <ProseView content={text} positions />
                </FeaturePassage>
              ) : (
                <ProseView content={text} positions />
              )}
            </div>
          </ShowAuthors>
          <BackToTop />
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
