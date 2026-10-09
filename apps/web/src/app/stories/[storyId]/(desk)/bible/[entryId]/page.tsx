import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { countEntryMentions } from "@coscribe/editor";
import { getChapters, getEntries, getStory, liveWriter, storyAuthors } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { canDeleteEntries } from "@/lib/story-roles";
import { entryMentionEntries, type EntryMentionEntry } from "@/lib/entries";
import { fetchStoryContent } from "@/lib/sync";
import { deleteEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { LiveDocument } from "@/components/LiveDocument";
import { EntryDetails } from "./EntryDetails";
import styles from "./entry.module.css";

async function load(storyId: string, entryId: string) {
  const [data, entries] = await Promise.all([getStory(storyId), getEntries(storyId)]);
  const all = entryMentionEntries(entries);
  const entry = all.find((e) => e.id === entryId);
  return data && entry ? { ...data, entries: all, entry } : null;
}

export async function generateMetadata(props: PageProps<"/stories/[storyId]/bible/[entryId]">): Promise<Metadata> {
  const { storyId, entryId } = await props.params;
  const data = await load(storyId, entryId);
  return { title: data ? `${data.entry.name} · ${data.story.title}` : "Entry" };
}

export default async function EntryPage(props: PageProps<"/stories/[storyId]/bible/[entryId]">) {
  const { storyId, entryId } = await props.params;
  const data = await load(storyId, entryId);
  if (!data) {
    if (!(await getViewer())) {
      redirect(`/login?next=${encodeURIComponent(`/stories/${storyId}/bible/${entryId}`)}`);
    }
    notFound();
  }
  const { story, entries, entry, myRole } = data;
  const editable = !!myRole && story.status !== "finished";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <EntryDetails
          key={entry.id}
          storyId={story.id}
          entry={entry}
          editable={editable}
          actions={
            editable &&
            canDeleteEntries(myRole) && (
              <ActionForm
                action={deleteEntry.bind(null, story.id, entry.id)}
                confirm={`Delete "${entry.name}" from the Story Bible? This can't be undone.`}
              >
                <button className="button button-ghost button-tiny button-danger">Delete</button>
              </ActionForm>
            )
          }
        />
      </header>

      <LiveDocument
        key={entry.id}
        kind="entry"
        id={entry.id}
        writer={liveWriter(data)}
        authors={storyAuthors(data)}
        entryMentions={{ storyId: story.id, entries: entries.map((e) => (e.id === entry.id ? { ...e, linkEntryMentions: false } : e)) }}
      />

      <section className={styles.entryMentioned} aria-labelledby="mentioned-in">
        <h2 id="mentioned-in" className="smallcaps">
          Mentioned in
        </h2>
        <Suspense fallback={<p className="muted">Counting Mentions…</p>}>
          <MentionedIn storyId={story.id} entry={entry} entries={entries} />
        </Suspense>
      </section>
    </div>
  );
}

/** Each Chapter that mentions the Entry, with how often, linking to the first Entry Mention. */
async function MentionedIn({ storyId, entry, entries }: { storyId: string; entry: EntryMentionEntry; entries: EntryMentionEntry[] }) {
  if (!entry.linkEntryMentions) {
    return <p className="muted">Mentions aren&rsquo;t linked for this Entry.</p>;
  }
  const [chapters, content] = await Promise.all([getChapters(storyId), fetchStoryContent(storyId)]);
  if (!content) return <p className="muted">Mentions can&rsquo;t be counted right now.</p>;

  const found = chapters.flatMap((chapter, i) => {
    const body = content.chapter[chapter.id];
    const count = body ? (countEntryMentions(body, entries).get(entry.id) ?? 0) : 0;
    return count ? [{ ...chapter, number: i + 1, count }] : [];
  });
  if (!found.length) return <p className="muted">No Chapter mentions {entry.name} yet.</p>;

  return (
    <ul className={styles.entryMentions}>
      {found.map((c) => (
        <li key={c.id}>
          <Link href={`/stories/${storyId}/chapters/${c.id}#entry-mention-${entry.id}`} className={styles.entryMentionLink}>
            <span className={styles.entryMentionNumber}>{c.number}</span>
            <span className={styles.entryMentionTitle}>{c.title}</span>
            <span className={styles.entryMentionCount}>
              {c.count} {c.count === 1 ? "Mention" : "Mentions"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
