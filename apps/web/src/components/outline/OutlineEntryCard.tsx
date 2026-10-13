"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ENTRY_TYPE_LABEL, type EntryMentionEntry } from "@/lib/entries";
import { EntryDetails, EntryName } from "../EntryDetails";
import { LiveDocument, type StoryAuthor, type Writer } from "../LiveDocument";
import { CloseIcon } from "../icons";
import modal from "../Modal.module.css";
import styles from "./outline.module.css";

/**
 * A Character's Entry beside the Outline: name, description and Aliases editable by Writers of an
 * unFinished Story, whatever the Outline's own rights, and its live body. Takes focus when it opens and,
 * closing, hands it back to whatever had it (the chip).
 */
export function OutlineEntryCard({
  storyId,
  entry,
  editable,
  writer,
  authors,
  onClose,
}: {
  storyId: string;
  entry: EntryMentionEntry;
  editable: boolean;
  writer: Writer | null;
  authors: StoryAuthor[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    card?.focus();
    return () => {
      // Not when focus has already moved on, as to the next chip.
      const now = document.activeElement;
      if (!now || now === document.body || card?.contains(now)) opener?.focus();
    };
  }, []);

  return (
    <section ref={ref} className={styles.card} aria-label={entry.name} tabIndex={-1}>
      <header className={modal.head}>
        <div className={modal.titles}>
          <span className={`smallcaps ${modal.eyebrow}`}>{ENTRY_TYPE_LABEL[entry.type]}</span>
          <EntryName storyId={storyId} entry={entry} editable={editable} as="h2" className={modal.heading} />
        </div>
        <button type="button" className={modal.close} onClick={onClose} aria-label={`Close ${entry.name}`}>
          <CloseIcon className={modal.closeIcon} />
        </button>
      </header>
      <div className={`${modal.body} ${styles.cardBody}`}>
        <button type="button" className={styles.back} onClick={onClose} data-modal-back>
          &larr; Outline
        </button>
        <EntryDetails storyId={storyId} entry={entry} editable={editable} variant="card" />
        <div className={styles.cardDocument}>
          <LiveDocument kind="entry" id={entry.id} writer={writer} authors={authors} embedded />
        </div>
        <Link href={`/stories/${storyId}/bible/${entry.id}`} className={styles.open}>
          Open Entry &rarr;
        </Link>
      </div>
    </section>
  );
}
