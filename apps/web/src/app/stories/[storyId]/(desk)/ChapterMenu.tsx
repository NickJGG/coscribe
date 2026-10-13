import { deleteChapter, moveChapterTo, renameChapter, setChapterLocked } from "@/lib/actions/chapters";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import styles from "./menu.module.css";

type Chapter = { id: string; title: string; locked: boolean };

/** A Chapter's "···" menu: Rename, Lock, Move and Delete, for Co-hosts and up. */
export function ChapterMenu({
  storyId,
  chapter,
  upAfter,
  downAfter,
  only,
}: {
  storyId: string;
  chapter: Chapter;
  /** Where Move up and Move down land, as `moveChapterTo`'s `afterId`; `undefined` hides the item. */
  upAfter?: string | null;
  downAfter?: string;
  only: boolean;
}) {
  return (
    <Dropdown
      label={`${chapter.title} options`}
      trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
      triggerClassName={styles.more}
      fixed
      panelClassName={styles.menu}
    >
      <details>
        <summary className={styles.menuItem}>Rename</summary>
        <ActionForm action={renameChapter.bind(null, storyId, chapter.id)} className={styles.renameForm}>
          <input
            name="title"
            className="input"
            defaultValue={chapter.title}
            maxLength={120}
            required
            aria-label="Chapter title"
          />
          <button className="button button-small">Save</button>
        </ActionForm>
      </details>
      <ActionForm action={setChapterLocked.bind(null, storyId, chapter.id, !chapter.locked)}>
        <button className={styles.menuItem}>{chapter.locked ? "Unlock" : "Lock"}</button>
      </ActionForm>
      {upAfter !== undefined && (
        <ActionForm action={moveChapterTo.bind(null, storyId, chapter.id, upAfter)}>
          <button className={styles.menuItem}>Move up</button>
        </ActionForm>
      )}
      {downAfter !== undefined && (
        <ActionForm action={moveChapterTo.bind(null, storyId, chapter.id, downAfter)}>
          <button className={styles.menuItem}>Move down</button>
        </ActionForm>
      )}
      {!only && (
        <>
          <hr className={styles.divider} />
          <ActionForm
            action={deleteChapter.bind(null, storyId, chapter.id)}
            confirm={`Delete “${chapter.title}”? It goes to the Trash in Settings for 30 days, where the Host or a Co-host can restore it.`}
          >
            <button className={`${styles.menuItem} ${styles.danger}`}>Delete</button>
          </ActionForm>
        </>
      )}
    </Dropdown>
  );
}
