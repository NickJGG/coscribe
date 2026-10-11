import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireReader } from "@/lib/reader";
import { ENTRY_TYPE_LABEL, entryGroups } from "@/lib/entries";
import { ProseView } from "@/components/ProseView";
import { Unavailable } from "../Unavailable";
import styles from "../reader.module.css";

export async function generateMetadata(props: PageProps<"/stories/[storyId]/read/bible">): Promise<Metadata> {
  const data = await getStory((await props.params).storyId);
  return { title: data ? `Story Bible · ${data.story.title}` : "Story Bible" };
}

export default async function ReaderBiblePage(props: PageProps<"/stories/[storyId]/read/bible">) {
  const { storyId } = await props.params;
  const { story, entries, content } = await requireReader(storyId, `/stories/${storyId}/read/bible`);
  if (!entries.length) notFound();

  const groups = entryGroups(entries, story.entry_type_order);

  return (
    <div className={styles.page}>
      <header className={styles.chapterHead}>
        <h1 className={styles.chapterTitle}>Story Bible</h1>
        {groups.length > 1 && (
          <ul className={styles.typeIndex}>
            {groups.map(({ type, entries }) => (
              <li key={type}>
                <a href={`#${type}`} className="button button-small">
                  {ENTRY_TYPE_LABEL[type]} ({entries.length})
                </a>
              </li>
            ))}
          </ul>
        )}
      </header>

      {!content && <Unavailable />}

      {groups.map(({ type, entries }) => (
        <section key={type} id={type} className={styles.typeSection} aria-labelledby={`${type}-heading`}>
          <h2 id={`${type}-heading`} className={styles.eyebrow}>
            {ENTRY_TYPE_LABEL[type]}
          </h2>
          {entries.map((entry) => {
            const body = content?.entry[entry.id];
            return (
              <article key={entry.id} id={entry.id} className={styles.entry}>
                <h3 className={styles.entryName}>{entry.name}</h3>
                {entry.description && <p className={styles.entryDescription}>{entry.description}</p>}
                {body?.content?.length ? (
                  <div className={styles.text}>
                    <ProseView content={body} />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
