import Link from "next/link";
import { relativeTime } from "@/lib/relative-time";
import { canManageChapters, type MemberRole } from "@/lib/story-roles";
import { deleteChapter, moveChapter, renameChapter, setChapterLocked } from "@/lib/actions/chapters";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import styles from "./story.module.css";

type Chapter = { id: string; title: string; locked: boolean; word_count: number; edited_at: string | null };

export function ChapterList({
  storyId,
  chapters,
  myRole,
  finished,
}: {
  storyId: string;
  chapters: Chapter[];
  myRole: MemberRole | null;
  finished: boolean;
}) {
  const manage = canManageChapters(myRole) && !finished;

  return (
    <ol className={styles.chapters}>
      {chapters.map((chapter, i) => (
        <li key={chapter.id} className={styles.chapter}>
          <span className={styles.chapterNumber}>{i + 1}</span>
          <Link href={`/stories/${storyId}/chapters/${chapter.id}`} className={styles.chapterTitle}>
            {chapter.title}
          </Link>
          {manage && (
            <ChapterMenu storyId={storyId} chapter={chapter} first={i === 0} last={i === chapters.length - 1} only={chapters.length === 1} />
          )}
          <span className={styles.chapterSub}>
            {chapter.edited_at ? (
              <span>
                <span className={styles.tnum}>{chapter.word_count.toLocaleString("en-US")}</span>{" "}
                {chapter.word_count === 1 ? "word" : "words"} · edited {relativeTime(Date.parse(chapter.edited_at))}
              </span>
            ) : (
              <span>No words yet</span>
            )}
            {chapter.locked && (
              <span className={styles.locked}>
                <LockIcon /> Locked
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ChapterMenu({
  storyId,
  chapter,
  first,
  last,
  only,
}: {
  storyId: string;
  chapter: Chapter;
  first: boolean;
  last: boolean;
  only: boolean;
}) {
  return (
    <Dropdown
      label={`${chapter.title} options`}
      trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
      className={styles.menuWrap}
      triggerClassName={styles.more}
      panelClassName={styles.menu}
    >
      <details>
        <summary className={styles.menuItem}>Rename</summary>
        <ActionForm action={renameChapter.bind(null, storyId, chapter.id)} className={styles.renameForm}>
          <input
            name="title"
            className="input"
            defaultValue={chapter.title}
            maxLength={120}
            required
            aria-label="Chapter title"
          />
          <button className="button button-small">Save</button>
        </ActionForm>
      </details>
      <ActionForm action={setChapterLocked.bind(null, storyId, chapter.id, !chapter.locked)}>
        <button className={styles.menuItem}>{chapter.locked ? "Unlock" : "Lock"}</button>
      </ActionForm>
      {!first && (
        <ActionForm action={moveChapter.bind(null, storyId, chapter.id, -1)}>
          <button className={styles.menuItem}>Move up</button>
        </ActionForm>
      )}
      {!last && (
        <ActionForm action={moveChapter.bind(null, storyId, chapter.id, 1)}>
          <button className={styles.menuItem}>Move down</button>
        </ActionForm>
      )}
      {!only && (
        <>
          <hr className={styles.divider} />
          <ActionForm
            action={deleteChapter.bind(null, storyId, chapter.id)}
            confirm={`Delete "${chapter.title}" and everything written in it? This can't be undone.`}
          >
            <button className={`${styles.menuItem} ${styles.danger}`}>Delete</button>
          </ActionForm>
        </>
      )}
    </Dropdown>
  );
}

function LockIcon() {
  return (
    <svg className={styles.lockIcon} viewBox="0 0 16 16" aria-hidden>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
