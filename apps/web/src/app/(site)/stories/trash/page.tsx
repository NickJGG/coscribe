import type { Metadata } from "next";
import Link from "next/link";
import { getStoryTrash } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { relativeTime } from "@/lib/relative-time";
import { daysLeft } from "@/lib/trash";
import { emptyStoryTrash, restoreStory } from "@/lib/actions/stories";
import { ActionForm } from "@/components/ActionForm";
import styles from "../(list)/stories.module.css";

export const metadata: Metadata = { title: "Trash" };

/** The Stories the viewer deleted as Host, kept 30 days. */
export default async function StoryTrashPage() {
  await requireProfile("/stories/trash");
  const trash = await getStoryTrash();

  return (
    <div className={styles.page}>
      <Link href="/stories" className={styles.back}>
        &larr; Your stories
      </Link>
      <div className={styles.head}>
        <h1>Trash</h1>
        <p className="muted">
          {trash.length
            ? "Stories you delete wait here for 30 days, then they're gone for good. Restoring one brings everyone back in."
            : "Nothing in the Trash. Stories you delete wait here for 30 days."}
        </p>
      </div>

      {trash.length > 0 && (
        <>
          <ul className="rows">
            {trash.map((story) => (
              <li key={story.id} className="row">
                <div>
                  <span className={styles.trashTitle}>{story.title}</span>
                  <p className={`muted ${styles.trashMeta}`}>
                    Deleted {relativeTime(Date.parse(story.deleted_at))} &middot; {daysLeft(story.expires_at)}
                  </p>
                </div>
                <div className="row-actions">
                  <ActionForm action={restoreStory.bind(null, story.id)}>
                    <button className="button button-small">Restore</button>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.emptyTrash}>
            <div>
              <h2>Empty Trash</h2>
              <p className="muted">Deletes these stories for everyone now instead of in 30 days. Can&rsquo;t be undone.</p>
            </div>
            <ActionForm
              action={emptyStoryTrash}
              confirm={`Delete ${trash.length === 1 ? "the 1 story" : `all ${trash.length} stories`} in the Trash for good? This can't be undone.`}
            >
              <button className="button button-danger">Empty Trash&hellip;</button>
            </ActionForm>
          </div>
        </>
      )}
    </div>
  );
}
