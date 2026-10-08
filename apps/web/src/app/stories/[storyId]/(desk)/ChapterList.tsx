"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { moveChapterTo } from "@/lib/actions/chapters";
import type { ActionResult } from "@/lib/action-result";
import { afterId } from "@/lib/chapter-order";
import { shortWords } from "@/lib/words";
import { PresenceDots, type HereNow } from "@/components/StoryPresence";
import formStyles from "@/components/ActionForm.module.css";
import styles from "./desk.module.css";

type Chapter = { id: string; title: string; locked: boolean; word_count: number };

type ListProps = {
  storyId: string;
  chapters: Chapter[];
  chapterId?: string;
  here: HereNow[];
  noteCounts?: Record<string, number>;
  chapterMenus?: Record<string, React.ReactNode>;
};

/** The sidebar's Chapters. When `reorderable`, each row has a grip for dragging it to a new place. */
export function ChapterList({ reorderable, ...props }: ListProps & { reorderable: boolean }) {
  if (reorderable) return <SortableChapterList {...props} />;
  const { storyId, chapters, chapterId, here, noteCounts, chapterMenus } = props;
  return (
    <ol className={styles.list}>
      {chapters.map((chapter, i) => (
        <li key={chapter.id} className={styles.item}>
          <ChapterLink
            storyId={storyId}
            chapter={chapter}
            number={i + 1}
            current={chapter.id === chapterId}
            here={here}
            openNotes={noteCounts?.[chapter.id] ?? 0}
          />
          {chapterMenus && <span className={styles.itemMenu}>{chapterMenus[chapter.id]}</span>}
        </li>
      ))}
    </ol>
  );
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "To reorder a Chapter, press Space or Enter to pick it up. Use the arrow keys to move it, then Space or Enter to drop it, or Escape to cancel.",
};

/**
 * The order updates as soon as a Chapter is dropped and reverts if the move fails. While a drag is under way,
 * the list stays as it was when the drag began, so another Co-host's change can't shift rows under the pointer.
 */
function SortableChapterList({ storyId, chapters, chapterId, here, noteCounts, chapterMenus }: ListProps) {
  const dndId = useId();
  const [optimistic, setOptimistic] = useOptimistic(chapters);
  const [drag, setDrag] = useState<{ id: UniqueIdentifier; snapshot: Chapter[] } | null>(null);
  const [error, setError] = useState<ActionResult>(null);
  const [, startTransition] = useTransition();
  // dnd-kit announces from an effect, after the drop has already reordered the list.
  const dropMessage = useRef("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const list = drag?.snapshot ?? optimistic;
  const indexOf = (id: UniqueIdentifier) => list.findIndex((c) => c.id === id);
  const titleOf = (id: UniqueIdentifier) => list[indexOf(id)]?.title ?? "Chapter";
  const dragged = drag ? list[indexOf(drag.id)] : undefined;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up Chapter ${indexOf(active.id) + 1}, ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${titleOf(active.id)} is over Chapter ${indexOf(over.id) + 1}.` : `${titleOf(active.id)} is outside the list.`,
    onDragEnd: () => dropMessage.current,
    onDragCancel: ({ active }) => `Reordering cancelled. ${titleOf(active.id)} stayed at Chapter ${indexOf(active.id) + 1}.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null);
    const from = indexOf(active.id);
    const to = over ? indexOf(over.id) : -1;
    if (from < 0 || to < 0 || from === to) {
      dropMessage.current = `${titleOf(active.id)} stayed at Chapter ${from + 1}.`;
      return;
    }
    dropMessage.current = `${titleOf(active.id)} moved to Chapter ${to + 1}.`;
    const next = arrayMove(list, from, to);
    startTransition(async () => {
      setOptimistic(next);
      setError(await moveChapterTo(storyId, String(active.id), afterId(next.map((c) => c.id), to)));
    });
  };

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        onDragStart={({ active }) => {
          setError(null);
          setDrag({ id: active.id, snapshot: optimistic });
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <SortableContext items={list.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ol className={styles.list}>
            {list.map((chapter, i) => (
              <SortableChapter
                key={chapter.id}
                storyId={storyId}
                chapter={chapter}
                number={i + 1}
                current={chapter.id === chapterId}
                here={here}
                openNotes={noteCounts?.[chapter.id] ?? 0}
                menu={chapterMenus?.[chapter.id]}
              />
            ))}
          </ol>
        </SortableContext>
        <DragOverlay>
          {dragged && (
            <div className={`${styles.item} ${styles.sortable} ${styles.lifted}`}>
              <div className={styles.row}>
                <ChapterRowBody
                  chapter={dragged}
                  number={indexOf(dragged.id) + 1}
                  here={here}
                  openNotes={noteCounts?.[dragged.id] ?? 0}
                />
              </div>
              <span className={styles.grip} aria-hidden>
                <GripIcon />
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {error && (
        <p role="alert" className={`${formStyles.error} ${styles.listError}`}>
          {error}
        </p>
      )}
    </>
  );
}

type RowProps = { storyId: string; chapter: Chapter; number: number; current: boolean; here: HereNow[]; openNotes: number };

function SortableChapter({ menu, ...row }: RowProps & { menu?: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.chapter.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${styles.item} ${styles.sortable} ${isDragging ? styles.placeholder : ""}`}
    >
      <ChapterLink {...row} />
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.grip}
        aria-label={`Reorder ${row.chapter.title}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      {menu && <span className={styles.itemMenu}>{menu}</span>}
    </li>
  );
}

function ChapterLink({ storyId, current, ...body }: RowProps) {
  return (
    <Link
      href={`/stories/${storyId}/chapters/${body.chapter.id}`}
      scroll={false}
      className={styles.row}
      aria-current={current ? "page" : undefined}
    >
      <ChapterRowBody {...body} />
    </Link>
  );
}

function ChapterRowBody({
  chapter,
  number,
  here,
  openNotes,
}: {
  chapter: Chapter;
  number: number;
  here: HereNow[];
  openNotes: number;
}) {
  const inside = here.filter((h) => h.documentId === chapter.id);
  return (
    <>
      <span className={styles.num}>{number}</span>
      <span className={styles.name}>{chapter.title}</span>
      <span className={styles.meta}>
        {openNotes > 0 && (
          <span className={styles.noteCount} title={openNotes === 1 ? "1 open Note" : `${openNotes} open Notes`}>
            <NoteIcon />
            {openNotes}
            <span className="sr-only"> open {openNotes === 1 ? "Note" : "Notes"},</span>
          </span>
        )}
        {chapter.locked && (
          <>
            <LockIcon />
            <span className="sr-only">Locked,</span>
          </>
        )}
        {inside.length ? (
          <PresenceDots here={inside} />
        ) : (
          <>
            {shortWords(chapter.word_count)}
            <span className="sr-only"> words</span>
          </>
        )}
      </span>
    </>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {[3.5, 8, 12.5].map((y) => (
        <g key={y}>
          <circle cx="5.5" cy={y} r="1.3" />
          <circle cx="10.5" cy={y} r="1.3" />
        </g>
      ))}
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className={styles.noteIcon} viewBox="0 0 20 20" aria-hidden>
      <path d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3.5 3v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className={styles.lock} viewBox="0 0 20 20" aria-hidden>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}
