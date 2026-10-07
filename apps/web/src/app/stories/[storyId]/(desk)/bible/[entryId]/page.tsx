import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEntry, getStory, liveWriter, storyAuthors } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { canDeleteEntries } from "@/lib/story-roles";
import { DESCRIPTION_MAX, ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX } from "@/lib/entries";
import { deleteEntry, updateEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { LiveDocument } from "@/components/LiveDocument";
import styles from "./entry.module.css";

async function load(storyId: string, entryId: string) {
  const [data, entry] = await Promise.all([getStory(storyId), getEntry(storyId, entryId)]);
  return data && entry ? { ...data, entry } : null;
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
  const { story, entry, myRole } = data;
  const editable = myRole && story.status !== "finished";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href={`/stories/${story.id}`} className="muted">
          &larr; {story.title}
        </Link>
        <div className={styles.meta}>
          <span className="pill">{ENTRY_TYPE_LABEL[entry.type]}</span>
          <span className="muted">Story Bible</span>
        </div>
        <h1 className={styles.title}>{entry.name}</h1>
        {entry.description && <p className={styles.description}>{entry.description}</p>}

        {editable && (
          <div className="row-actions">
            <details className={styles.edit}>
              <summary className="button button-small">Edit details</summary>
              <ActionForm action={updateEntry.bind(null, story.id, entry.id)} className={styles.form}>
                <label className={styles.field}>
                  <span className={styles.label}>Type</span>
                  <select name="type" className="input" defaultValue={entry.type}>
                    {ENTRY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ENTRY_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Name</span>
                  <input name="name" className="input" defaultValue={entry.name} maxLength={NAME_MAX} required />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>Short description</span>
                  <textarea
                    name="description"
                    className={`input ${styles.textarea}`}
                    defaultValue={entry.description}
                    maxLength={DESCRIPTION_MAX}
                    rows={3}
                  />
                </label>
                <div>
                  <button className="button button-primary button-small">Save</button>
                </div>
              </ActionForm>
            </details>
            {canDeleteEntries(myRole) && (
              <ActionForm
                action={deleteEntry.bind(null, story.id, entry.id)}
                confirm={`Delete "${entry.name}" from the Story Bible? This can't be undone.`}
              >
                <button className="button button-small button-danger">Delete</button>
              </ActionForm>
            )}
          </div>
        )}
      </header>

      <LiveDocument
        key={entry.id}
        kind="entry"
        id={entry.id}
        writer={liveWriter(data)}
        authors={storyAuthors(data)}
      />
    </div>
  );
}
