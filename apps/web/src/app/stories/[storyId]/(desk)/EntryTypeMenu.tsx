import { moveEntryType } from "@/lib/actions/entries";
import { ENTRY_GROUP_LABEL, type EntryType } from "@/lib/entries";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import styles from "./menu.module.css";

/** An Entry Type heading's "···" menu: Move up and Move down, for Co-hosts and up. */
export function EntryTypeMenu({
  storyId,
  type,
  upAfter,
  downAfter,
}: {
  storyId: string;
  type: EntryType;
  /** Where Move up and Move down land, as `moveEntryType`'s `afterType`; `undefined` hides the item. */
  upAfter?: EntryType | null;
  downAfter?: EntryType;
}) {
  return (
    <Dropdown
      label={`${ENTRY_GROUP_LABEL[type]} options`}
      trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
      triggerClassName={styles.more}
      fixed
      panelClassName={styles.menu}
    >
      {upAfter !== undefined && (
        <ActionForm action={moveEntryType.bind(null, storyId, type, upAfter)}>
          <button className={styles.menuItem}>Move up</button>
        </ActionForm>
      )}
      {downAfter !== undefined && (
        <ActionForm action={moveEntryType.bind(null, storyId, type, downAfter)}>
          <button className={styles.menuItem}>Move down</button>
        </ActionForm>
      )}
    </Dropdown>
  );
}
