"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AvatarStack } from "@/components/Avatar";
import { useLiveStatus } from "@/components/LiveStatus";
import { useDeskFrame } from "./DeskFrame";
import styles from "./desk.module.css";

/** Story / current Chapter or Entry. On phones the current title opens the sidebar sheet. */
export function Breadcrumb({
  storyId,
  storyTitle,
  chapters,
  entries,
}: {
  storyId: string;
  storyTitle: string;
  chapters: { id: string; title: string }[];
  entries: { id: string; name: string }[];
}) {
  const { open } = useDeskFrame();
  const { chapterId, entryId } = useParams<{ chapterId?: string; entryId?: string }>();
  const current = chapterId
    ? chapters.find((c) => c.id === chapterId)?.title
    : entries.find((e) => e.id === entryId)?.name;

  return (
    <nav className={styles.crumbs} aria-label="Breadcrumb">
      <Link href={`/stories/${storyId}`} className={styles.crumbStory}>
        {storyTitle}
      </Link>
      {current && (
        <>
          <span className={styles.slash} aria-hidden>
            /
          </span>
          <span className={styles.crumbCurrent} aria-current="page">
            {current}
          </span>
          <button
            type="button"
            className={styles.crumbSheet}
            onClick={() => open(entryId ? "bible" : "chapters")}
            aria-label={`${current}. Open the sidebar`}
          >
            <span>{current}</span> <span aria-hidden>&#9662;</span>
          </button>
        </>
      )}
    </nav>
  );
}

/** Writers in the open document, and whether it's live. Viewers see how many are watching instead. */
export function DeskStatus({ member }: { member: boolean }) {
  const { doc, connection, slow, readOnly, writers, viewers } = useLiveStatus();
  if (!doc) return null;

  const label =
    connection === "live"
      ? member
        ? readOnly
          ? "Live · Read-only"
          : "Live"
        : `Watching live · ${viewers} ${viewers === 1 ? "Viewer" : "Viewers"}`
      : connection === "offline"
        ? "Reconnecting…"
        : connection === "connecting" && slow
          ? "Connecting…"
          : null;

  return (
    <>
      {writers.length > 0 && (
        <span className={styles.writers}>
          <AvatarStack people={writers} size="sm" />
        </span>
      )}
      {label && (
        <span className={styles.live} data-connection={connection} data-member={member || undefined} role="status">
          {label}
        </span>
      )}
    </>
  );
}
