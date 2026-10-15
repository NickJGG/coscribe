import { deleteEntry, editEntry, moveEntryTo, renameEntry } from "@/lib/actions/entries";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX, type EntryType } from "@/lib/entries";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import styles from "./menu.module.css";

type Entry = { id: string; type: EntryType; name: string };

/** An Entry's "···" menu: Rename and Change type for Writers, Move for Co-hosts and up, Delete for those who may. */
export function EntryMenu({
  storyId,
  entry,
  upAfter,
  downAfter,
  deletable,
}: {
  storyId: string;
  entry: Entry;
  /** Where Move up and Move down land within the Entry's type, as `moveEntryTo`'s `afterId`; `undefined` hides the item. */
  upAfter?: string | null;
  downAfter?: string;
  deletable: boolean;
}) {
  return (
    <Dropdown
      label={`${entry.name} options`}
      trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
      triggerClassName={styles.more}
      fixed
      panelClassName={styles.menu}
    >
      <details>
        <summary className="menu-item">Rename</summary>
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
          <button className="menu-item" aria-pressed={type === entry.type}>
            {ENTRY_TYPE_LABEL[type]}
            {type === entry.type && <span className={styles.check} aria-hidden>✓</span>}
          </button>
        </ActionForm>
      ))}
      {(upAfter !== undefined || downAfter !== undefined) && <hr className="menu-divider" />}
      {upAfter !== undefined && (
        <ActionForm action={moveEntryTo.bind(null, storyId, entry.id, upAfter)}>
          <button className="menu-item">Move up</button>
        </ActionForm>
      )}
      {downAfter !== undefined && (
        <ActionForm action={moveEntryTo.bind(null, storyId, entry.id, downAfter)}>
          <button className="menu-item">Move down</button>
        </ActionForm>
      )}
      {deletable && (
        <>
          <hr className="menu-divider" />
          <ActionForm
            action={deleteEntry.bind(null, storyId, entry.id)}
            confirm={{
              title: `Delete “${entry.name}”?`,
              body: "It goes to the Trash in Settings for 30 days, where the Host or a Co-host can restore it.",
              action: "Delete",
              danger: true,
            }}
          >
            <button className="menu-item menu-item-danger">Delete</button>
          </ActionForm>
        </>
      )}
    </Dropdown>
  );
}
