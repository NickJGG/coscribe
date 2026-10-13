"use client";

import { useState } from "react";
import { OutlineIcon } from "../icons";
import type { EntryMentionEntry } from "@/lib/entries";
import type { StoryAuthor, Writer } from "../LiveDocument";
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
  entryEditable,
  writer,
  authors,
  hasContent: initialContent,
}: {
  storyId: string;
  chapterId: string;
  eyebrow: string;
  characters: EntryMentionEntry[];
  entryEditable: boolean;
  writer: Writer | null;
  authors: StoryAuthor[];
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
          entryEditable={entryEditable}
          writer={writer}
          authors={authors}
          onContent={setHasContent}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
