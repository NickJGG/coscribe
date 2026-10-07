"use client";

import { useRef, useState, useTransition } from "react";
import { renameChapter } from "@/lib/actions/chapters";
import styles from "./chapter.module.css";

/** The Chapter's title; Co-hosts and up click it to rename it in place. Enter saves, Escape cancels. */
export function ChapterTitle({
  storyId,
  chapterId,
  title,
  renamable,
}: {
  storyId: string;
  chapterId: string;
  title: string;
  renamable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Disabling or removing the focused input blurs it, which would save a second time.
  const settled = useRef(false);

  if (!renamable) return <h1 className={styles.title}>{title}</h1>;

  function edit() {
    settled.current = false;
    setEditing(true);
  }

  function save(input: HTMLInputElement) {
    if (settled.current) return;
    settled.current = true;
    const next = input.value.trim();
    if (next === title) return setEditing(false);
    const formData = new FormData();
    formData.set("title", next);
    startTransition(async () => {
      const result = await renameChapter(storyId, chapterId, null, formData);
      setError(result);
      if (result) settled.current = false;
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <h1 className={styles.title}>
        <button type="button" className={styles.titleButton} onClick={edit} title="Rename">
          {title}
        </button>
      </h1>
    );
  }

  return (
    <div className={styles.rename}>
      <input
        className={styles.titleInput}
        defaultValue={title}
        aria-label="Chapter title"
        maxLength={120}
        disabled={pending}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => save(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save(e.currentTarget);
          } else if (e.key === "Escape") {
            e.preventDefault();
            settled.current = true;
            setError(null);
            setEditing(false);
          }
        }}
      />
      {error && (
        <p role="alert" className={styles.renameError}>
          {error}
        </p>
      )}
    </div>
  );
}
