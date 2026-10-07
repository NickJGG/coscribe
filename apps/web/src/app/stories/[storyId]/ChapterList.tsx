import Link from "next/link";
import { canManageChapters, type MemberRole } from "@/lib/story-roles";
import { addChapter, deleteChapter, moveChapter, renameChapter, setChapterLocked } from "@/lib/actions/chapters";
import { ActionForm } from "@/components/ActionForm";
import styles from "./story.module.css";

type Chapter = { id: string; title: string; locked: boolean };

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
    <>
      <ol className="rows">
        {chapters.map((chapter, i) => (
          <li key={chapter.id} className="row">
            <span className={styles.chapterTitle}>
              <span className="muted">{i + 1}.</span>{" "}
              <Link href={`/stories/${storyId}/chapters/${chapter.id}`}>{chapter.title}</Link>
              {chapter.locked && <span className="pill">Locked</span>}
            </span>
            {manage && (
              <div className="row-actions">
                <ActionForm action={moveChapter.bind(null, storyId, chapter.id, -1)}>
                  <button className="button button-small" disabled={i === 0} aria-label={`Move ${chapter.title} up`}>
                    &uarr;
                  </button>
                </ActionForm>
                <ActionForm action={moveChapter.bind(null, storyId, chapter.id, 1)}>
                  <button
                    className="button button-small"
                    disabled={i === chapters.length - 1}
                    aria-label={`Move ${chapter.title} down`}
                  >
                    &darr;
                  </button>
                </ActionForm>
                <ActionForm action={setChapterLocked.bind(null, storyId, chapter.id, !chapter.locked)}>
                  <button className="button button-small">{chapter.locked ? "Unlock" : "Lock"}</button>
                </ActionForm>
                <details className={styles.rename}>
                  <summary className="button button-small">Rename</summary>
                  <ActionForm action={renameChapter.bind(null, storyId, chapter.id)} className={styles.inlineForm}>
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
                {chapters.length > 1 && (
                  <ActionForm
                    action={deleteChapter.bind(null, storyId, chapter.id)}
                    confirm={`Delete "${chapter.title}" and everything written in it? This can't be undone.`}
                  >
                    <button className="button button-small button-danger">Delete</button>
                  </ActionForm>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {myRole && !finished && (
        <ActionForm action={addChapter.bind(null, storyId)} className={styles.inlineForm}>
          <input
            name="title"
            className="input"
            defaultValue={`Chapter ${chapters.length + 1}`}
            maxLength={120}
            required
            aria-label="New Chapter title"
          />
          <button className="button">Add Chapter</button>
        </ActionForm>
      )}
    </>
  );
}
