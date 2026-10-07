import type { Metadata } from "next";
import Link from "next/link";
import { getStory } from "@/lib/story";
import { requireReader } from "@/lib/reader";
import { ReaderNav } from "./ReaderNav";
import styles from "./reader.module.css";

export async function generateMetadata(props: PageProps<"/stories/[storyId]/read">): Promise<Metadata> {
  const data = await getStory((await props.params).storyId);
  return { title: data?.story.title ?? "Story" };
}

const finishedOn = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

/** The Reader View's title page: who wrote it, and the table of contents. */
export default async function ReaderPage(props: PageProps<"/stories/[storyId]/read">) {
  const { storyId } = await props.params;
  const { story, chapters, entries, credits, members } = await requireReader(storyId, `/stories/${storyId}/read`);
  const first = chapters[0];

  // Credits order (most written first), falling back to members if the text couldn't be loaded.
  const names = credits?.flatMap((c) => (c.person && c.chapters + c.bible > 0 ? [c.person.username] : [])) ?? [];
  const byline = names.length ? names : members.map((m) => m.profile.username);

  return (
    <div className={styles.page}>
      <ReaderNav story={story} current="contents" hasBible={entries.length > 0} />

      <header className={styles.titlePage}>
        <p className={styles.eyebrow}>A Coscribe story</p>
        <h1 className={styles.bookTitle}>{story.title}</h1>
        <p className={styles.byline}>by {listFormat.format(byline)}</p>
        {story.finished_at && (
          <p className="muted">Finished {finishedOn.format(new Date(story.finished_at))}</p>
        )}
        {first && (
          <Link href={`/stories/${story.id}/read/${first.id}`} className="button button-primary">
            Start reading
          </Link>
        )}
      </header>

      <section className="section" aria-labelledby="contents-heading">
        <h2 id="contents-heading">Contents</h2>
        <ol className={styles.contents}>
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <Link href={`/stories/${story.id}/read/${chapter.id}`}>{chapter.title}</Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
