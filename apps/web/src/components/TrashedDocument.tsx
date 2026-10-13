import Link from "next/link";
import { getStory, getTrash } from "@/lib/story";
import { canManageChapters } from "@/lib/story-roles";
import { restoreChapter } from "@/lib/actions/chapters";
import { restoreEntry } from "@/lib/actions/entries";
import { ActionForm } from "./ActionForm";
import styles from "./TrashedDocument.module.css";

const NOUN = { chapter: "Chapter", entry: "Entry" };

/**
 * What a Chapter or Entry page shows once its document is in the Trash: who put it there, a link to the
 * Trash and, for Co-hosts and up, Restore. Null when it isn't in the Trash or the viewer can't see the Trash.
 */
export async function trashedDocument(storyId: string, kind: "chapter" | "entry", id: string) {
  const [data, trash] = await Promise.all([getStory(storyId), getTrash(storyId)]);
  const item = trash.find((t) => t.kind === kind && t.id === id);
  if (!data?.myRole || !item) return null;
  const finished = data.story.status === "finished";
  const restore = (kind === "chapter" ? restoreChapter : restoreEntry).bind(null, storyId, id, false);

  return (
    <div className={styles.trashed}>
      <span className="smallcaps">In the Trash</span>
      <h1 className={styles.title}>{item.title}</h1>
      <p role="status">
        {item.deleted_by_username ?? "Someone"} moved this {NOUN[kind]} to the Trash.
      </p>
      <div className="row-actions">
        <Link href={`/stories/${storyId}/settings/trash`} className="button">
          See the Trash
        </Link>
        {canManageChapters(data.myRole) && (
          <ActionForm action={restore}>
            <button className="button button-primary" disabled={finished}>
              Restore
            </button>
          </ActionForm>
        )}
      </div>
      {canManageChapters(data.myRole) && finished && <p className="muted">Reopen it to restore anything.</p>}
    </div>
  );
}
