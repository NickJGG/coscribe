"use client";

import { useOptimistic, useState, useTransition } from "react";
import { editEntry } from "@/lib/actions/entries";
import { DESCRIPTION_MAX, NAME_MAX, type EntryPatch, type EntryMentionEntry } from "@/lib/entries";
import type { ActionResult } from "@/lib/action-result";
import { InlineEdit } from "./InlineEdit";
import { Switch } from "./Switch";
import styles from "./EntryDetails.module.css";

/** An Entry's name, edited in place by Writers. */
export function EntryName({
  storyId,
  entry,
  editable,
  as,
  className,
}: {
  storyId: string;
  entry: EntryMentionEntry;
  editable: boolean;
  as: "h1" | "h2";
  className?: string;
}) {
  return (
    <InlineEdit
      as={as}
      className={className}
      value={entry.name}
      label="Name"
      maxLength={NAME_MAX}
      editable={editable}
      spellCheck={false}
      onSave={(name) => editEntry(storyId, entry.id, { name })}
    />
  );
}

/**
 * An Entry's description and Aliases, each edited in place by Writers, and on the Entry page its Link Entry
 * Mentions switch. Viewers see the same fields as plain text, without the Alias controls.
 */
export function EntryDetails({
  storyId,
  entry,
  editable,
  variant = "page",
}: {
  storyId: string;
  entry: EntryMentionEntry;
  editable: boolean;
  variant?: "page" | "card";
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
      <InlineEdit
        as="p"
        className={variant === "card" ? styles.cardDescription : styles.description}
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
          {variant === "page" && (
            <Switch
              className={styles.linkSwitch}
              checked={shown.linkEntryMentions}
              onChange={(linkEntryMentions) => saveNow({ linkEntryMentions })}
            >
              Link Entry Mentions in the text
            </Switch>
          )}
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
