import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { countEntryMentions } from "@coscribe/editor";
import { getChapters, getEntries, getStory, liveWriter, storyAuthors } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { canDeleteEntries, isWriter } from "@/lib/story-roles";
import { resolveToolbarLayout } from "@/lib/toolbar-layout";
import { entryMentionEntries, type EntryMentionEntry } from "@/lib/entries";
import { fetchStoryContent } from "@/lib/sync";
import { deleteEntry } from "@/lib/actions/entries";
import { BackToTop } from "@/components/BackToTop";
import { ActionForm } from "@/components/ActionForm";
import { LiveDocument } from "@/components/LiveDocument";
import { trashedDocument } from "@/components/TrashedDocument";
import { PinButton, PinError } from "@/components/PinnedEntries";
import { EntryDetails, EntryName } from "@/components/EntryDetails";
import { EntryTypePicker } from "./EntryTypePicker";
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
    const trashed = await trashedDocument(storyId, "entry", entryId);
    if (trashed) return trashed;
    if (!(await getViewer())) {
      redirect(`/login?next=${encodeURIComponent(`/stories/${storyId}/bible/${entryId}`)}`);
    }
    notFound();
  }
  const { story, entries, entry, myRole } = data;
  const editable = isWriter(myRole) && story.status !== "finished";
  const viewer = await getViewer();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.meta}>
          <EntryTypePicker key={entry.id} storyId={story.id} entryId={entry.id} type={entry.type} editable={editable} />
          <span className="muted">Story Bible</span>
          {myRole && (
            <div className={styles.actions}>
              <PinButton entryId={entry.id} entryName={entry.name} />
              {editable && canDeleteEntries(myRole) && (
                <ActionForm
                  action={deleteEntry.bind(null, story.id, entry.id)}
                  confirm={{
                    title: `Delete “${entry.name}”?`,
                    body: "It goes to the Trash in Settings for 30 days, where the Host or a Co-host can restore it.",
                    action: "Delete",
                    danger: true,
                  }}
                >
                  <button className="button button-ghost button-tiny button-danger">Delete</button>
                </ActionForm>
              )}
            </div>
          )}
        </div>
        <EntryName key={entry.id} storyId={story.id} entry={entry} editable={editable} as="h1" className={styles.title} />
        <EntryDetails key={entry.id} storyId={story.id} entry={entry} editable={editable} />
        <PinError entryId={entry.id} className={styles.error} />
      </header>

      <LiveDocument
        key={entry.id}
        kind="entry"
        id={entry.id}
        writer={liveWriter(data)}
        authors={storyAuthors(data)}
        toolbarLayout={resolveToolbarLayout(viewer?.profile?.toolbar_layout)}
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
      <BackToTop />
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
