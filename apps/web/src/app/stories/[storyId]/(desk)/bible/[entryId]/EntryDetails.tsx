"use client";

import { useOptimistic, useState, useTransition } from "react";
import { editEntry } from "@/lib/actions/entries";
import { DESCRIPTION_MAX, ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX, type EntryPatch, type EntryMentionEntry } from "@/lib/entries";
import type { ActionResult } from "@/lib/action-result";
import { InlineEdit } from "@/components/InlineEdit";
import { PinError } from "@/components/PinnedEntries";
import { Switch } from "@/components/Switch";
import { Dropdown } from "@/components/Dropdown";
import menu from "../../menu.module.css";
import styles from "./entry.module.css";

/**
 * An Entry's type, name, description and Aliases, each edited in place by Writers. Viewers see the same
 * fields as plain text, without the Alias controls.
 */
export function EntryDetails({
  storyId,
  entry,
  editable,
  actions,
}: {
  storyId: string;
  entry: EntryMentionEntry;
  editable: boolean;
  actions?: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [shown, show] = useOptimistic(entry, (e, patch: EntryPatch) => ({ ...e, ...patch }));
  const save = (patch: EntryPatch) => editEntry(storyId, entry.id, patch);

  function saveNow(patch: EntryPatch) {
    startTransition(async () => {
      show(patch);
      setError(await save(patch));
    });
  }

  return (
    <>
      <div className={styles.meta}>
        {editable ? (
          <Dropdown
            label="Entry type"
            trigger={
              <>
                {ENTRY_TYPE_LABEL[shown.type]} <span aria-hidden>&#9662;</span>
              </>
            }
            triggerClassName={`smallcaps ${styles.type}`}
            panelClassName={menu.menu}
            align="start"
          >
            {ENTRY_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={menu.menuItem}
                aria-pressed={type === shown.type}
                data-close
                onClick={() => type !== shown.type && saveNow({ type })}
              >
                {ENTRY_TYPE_LABEL[type]}
                {type === shown.type && (
                  <span className={menu.check} aria-hidden>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </Dropdown>
        ) : (
          <span className="smallcaps">{ENTRY_TYPE_LABEL[entry.type]}</span>
        )}
        <span className="muted">Story Bible</span>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <InlineEdit
        as="h1"
        className={styles.title}
        value={entry.name}
        label="Name"
        maxLength={NAME_MAX}
        editable={editable}
        spellCheck={false}
        onSave={(name) => save({ name })}
      />
      <InlineEdit
        as="p"
        className={styles.description}
        value={entry.description}
        label="Description"
        placeholder="Add a one-line description"
        maxLength={DESCRIPTION_MAX}
        editable={editable}
        onSave={(description) => save({ description })}
      />
      {editable ? (
        <div className={styles.aliasRow}>
          <Aliases aliases={entry.aliases} onSave={(aliases) => save({ aliases })} />
          <Switch
            className={styles.linkSwitch}
            checked={shown.linkEntryMentions}
            onChange={(linkEntryMentions) => saveNow({ linkEntryMentions })}
          >
            Link Entry Mentions in the text
          </Switch>
        </div>
      ) : (
        entry.aliases.length > 0 && (
          <ul className={styles.aliases} aria-label="Aliases">
            {entry.aliases.map((a) => (
              <li key={a} className={styles.alias}>
                {a}
              </li>
            ))}
          </ul>
        )
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <PinError entryId={entry.id} className={styles.error} />
    </>
  );
}

function Aliases({ aliases, onSave }: { aliases: string[]; onSave: (aliases: string[]) => Promise<ActionResult> }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit(next: string[], done?: () => void) {
    startTransition(async () => {
      const result = await onSave(next);
      setError(result);
      if (!result) done?.();
    });
  }

  return (
    <div className={styles.aliasBlock}>
      <ul className={styles.aliases} aria-label="Aliases">
        {aliases.map((a) => (
          <li key={a} className={styles.alias}>
            {a}
            <button
              type="button"
              className={styles.removeAlias}
              aria-label={`Remove Alias ${a}`}
              disabled={pending}
              onClick={() => commit(aliases.filter((x) => x !== a))}
            >
              &times;
            </button>
          </li>
        ))}
        <li>
          {adding ? (
            <input
              className={`input ${styles.aliasInput}`}
              spellCheck={false}
              aria-label="New Alias"
              placeholder="Another name"
              maxLength={NAME_MAX}
              disabled={pending}
              autoFocus
              onBlur={(e) => {
                if (!e.currentTarget.value.trim()) setAdding(false);
              }}
              onKeyDown={(e) => {
                const value = e.currentTarget.value.trim();
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (value) commit([...aliases, value], () => setAdding(false));
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setError(null);
                  setAdding(false);
                }
              }}
            />
          ) : (
            <button type="button" className={styles.addAlias} onClick={() => setAdding(true)}>
              + Add alias
            </button>
          )}
        </li>
      </ul>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
