"use client";

import Link from "next/link";
import type * as Y from "yjs";
import { addCharacter, removeCharacter } from "@coscribe/editor";
import { Dropdown } from "../Dropdown";
import styles from "./outline.module.css";

export type OutlineCharacter = { id: string; name: string };

/**
 * The Outline's Characters, as chips linking to their Entries. Ids whose Entry was deleted or is no longer
 * a Character stay in the document but aren't shown.
 */
export function OutlineCharacters({
  storyId,
  ydoc,
  ids,
  characters,
  readOnly,
  onNavigate,
}: {
  storyId: string;
  ydoc: Y.Doc;
  ids: string[];
  /** The Story's Character Entries. */
  characters: OutlineCharacter[];
  readOnly: boolean;
  onNavigate: () => void;
}) {
  const chosen = ids.flatMap((id) => characters.find((c) => c.id === id) ?? []);
  const available = characters.filter((c) => !ids.includes(c.id));

  return (
    <section className={styles.field}>
      <span className={`smallcaps ${styles.staticLabel}`}>Characters</span>
      <ul className={styles.chips} aria-label="Characters">
        {chosen.map((c) => (
          <li key={c.id} className={styles.chip}>
            <Link href={`/stories/${storyId}/bible/${c.id}`} className={styles.chipLink} onClick={onNavigate}>
              {c.name}
            </Link>
            {!readOnly && (
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${c.name} from the Outline`}
                onClick={() => removeCharacter(ydoc, c.id)}
              >
                &times;
              </button>
            )}
          </li>
        ))}
        {readOnly && chosen.length === 0 && <li className={styles.none}>None</li>}
        {!readOnly && (
          <li>
            <Dropdown
              label="Add a Character"
              trigger="+ Character"
              triggerClassName={styles.add}
              panelClassName={styles.picker}
              align="start"
              fixed
            >
              {available.length > 0 ? (
                available.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.pickerItem}
                    data-close
                    onClick={() => addCharacter(ydoc, c.id)}
                  >
                    {c.name}
                  </button>
                ))
              ) : (
                <p className={styles.pickerEmpty}>
                  {characters.length > 0 ? "Every Character is already here." : "This Story has no Characters yet."}
                </p>
              )}
            </Dropdown>
          </li>
        )}
      </ul>
    </section>
  );
}
