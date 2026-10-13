"use client";

import { useOptimistic, useState, useTransition } from "react";
import { editEntry } from "@/lib/actions/entries";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, type EntryType } from "@/lib/entries";
import { Dropdown } from "@/components/Dropdown";
import menu from "../../menu.module.css";
import styles from "./entry.module.css";

/** An Entry's type, a menu for Writers to change it. */
export function EntryTypePicker({
  storyId,
  entryId,
  type,
  editable,
}: {
  storyId: string;
  entryId: string;
  type: EntryType;
  editable: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [shown, show] = useOptimistic(type);

  if (!editable) return <span className="smallcaps">{ENTRY_TYPE_LABEL[type]}</span>;

  function choose(next: EntryType) {
    startTransition(async () => {
      show(next);
      setError(await editEntry(storyId, entryId, { type: next }));
    });
  }

  return (
    <>
      <Dropdown
        label="Entry type"
        trigger={
          <>
            {ENTRY_TYPE_LABEL[shown]} <span aria-hidden>&#9662;</span>
          </>
        }
        triggerClassName={`smallcaps ${styles.type}`}
        panelClassName={menu.menu}
        align="start"
      >
        {ENTRY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={menu.menuItem}
            aria-pressed={t === shown}
            data-close
            onClick={() => t !== shown && choose(t)}
          >
            {ENTRY_TYPE_LABEL[t]}
            {t === shown && (
              <span className={menu.check} aria-hidden>
                ✓
              </span>
            )}
          </button>
        ))}
      </Dropdown>
      {error && (
        <span role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </>
  );
}
