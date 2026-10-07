"use client";

import { renameChapter } from "@/lib/actions/chapters";
import { InlineEdit } from "@/components/InlineEdit";
import styles from "./chapter.module.css";

/** The Chapter's title; Co-hosts and up click it to rename it in place. */
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
  return (
    <InlineEdit
      as="h1"
      className={styles.title}
      value={title}
      label="Chapter title"
      maxLength={120}
      editable={renamable}
      onSave={(next) => {
        const formData = new FormData();
        formData.set("title", next);
        return renameChapter(storyId, chapterId, null, formData);
      }}
    />
  );
}
