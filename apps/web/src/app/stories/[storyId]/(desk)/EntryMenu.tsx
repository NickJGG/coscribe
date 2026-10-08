import { deleteEntry, editEntry, renameEntry } from "@/lib/actions/entries";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX, type EntryType } from "@/lib/entries";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import styles from "./menu.module.css";

type Entry = { id: string; type: EntryType; name: string };

/** An Entry's "···" menu: Rename and Change type for Writers, Delete for those who may. */
export function EntryMenu({ storyId, entry, deletable }: { storyId: string; entry: Entry; deletable: boolean }) {
  return (
    <Dropdown
      label={`${entry.name} options`}
      trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
      triggerClassName={styles.more}
      fixed
      panelClassName={styles.menu}
    >
      <details>
        <summary className={styles.menuItem}>Rename</summary>
        <ActionForm action={renameEntry.bind(null, storyId, entry.id)} className={styles.renameForm}>
          <input
            name="name"
            className="input"
            defaultValue={entry.name}
            maxLength={NAME_MAX}
            required
            aria-label="Entry name"
          />
          <button className="button button-small">Save</button>
        </ActionForm>
      </details>
      <h4 className={`smallcaps ${styles.menuHeading}`}>Change type</h4>
      {ENTRY_TYPES.map((type) => (
        <ActionForm key={type} action={editEntry.bind(null, storyId, entry.id, { type })}>
          <button className={styles.menuItem} aria-pressed={type === entry.type}>
            {ENTRY_TYPE_LABEL[type]}
            {type === entry.type && <span className={styles.check} aria-hidden>✓</span>}
          </button>
        </ActionForm>
      ))}
      {deletable && (
        <>
          <hr className={styles.divider} />
          <ActionForm
            action={deleteEntry.bind(null, storyId, entry.id)}
            confirm={`Delete "${entry.name}" from the Story Bible? This can't be undone.`}
          >
            <button className={`${styles.menuItem} ${styles.danger}`}>Delete</button>
          </ActionForm>
        </>
      )}
    </Dropdown>
  );
}
