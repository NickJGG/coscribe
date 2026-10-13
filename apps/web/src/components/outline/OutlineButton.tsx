"use client";

import { useState } from "react";
import { OutlineIcon } from "../icons";
import type { OutlineCharacter } from "./OutlineCharacters";
import { OutlineDialog } from "./OutlineDialog";
import styles from "./outline.module.css";

/**
 * The toolbar's way into the Chapter's Outline, for Writers, with a dot once the Outline has anything in
 * it. The Outline connects only while its dialog is open, so the dot is live only then.
 */
export function OutlineButton({
  storyId,
  chapterId,
  eyebrow,
  characters,
  hasContent: initialContent,
}: {
  storyId: string;
  chapterId: string;
  eyebrow: string;
  characters: OutlineCharacter[];
  hasContent: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hasContent, setHasContent] = useState(initialContent);

  return (
    <>
      <button
        type="button"
        className="button button-ghost button-tiny with-icon"
        data-tip="Outline"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <OutlineIcon />
        <span className="with-icon-label">Outline</span>
        {hasContent && (
          <span className={styles.dot}>
            <span className="sr-only">, has content</span>
          </span>
        )}
      </button>
      {open && (
        <OutlineDialog
          storyId={storyId}
          chapterId={chapterId}
          eyebrow={eyebrow}
          characters={characters}
          onContent={setHasContent}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
