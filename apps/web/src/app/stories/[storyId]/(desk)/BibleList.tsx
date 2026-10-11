"use client";

import { useId, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
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
import { moveEntryTo, moveEntryType } from "@/lib/actions/entries";
import type { ActionResult } from "@/lib/action-result";
import { afterId, placeAfter } from "@/lib/chapter-order";
import { ENTRY_GROUP_LABEL, entryGroups, type EntryType } from "@/lib/entries";
import { PresenceDots, type HereNow } from "@/components/StoryPresence";
import { GripIcon } from "@/components/icons";
import formStyles from "@/components/ActionForm.module.css";
import styles from "./desk.module.css";

type Entry = { id: string; type: EntryType; name: string };
type Order = { typeOrder: EntryType[]; entries: Entry[] };

type ListProps = {
  storyId: string;
  entries: Entry[];
  typeOrder: EntryType[];
  entryId?: string;
  here: HereNow[];
  entryMenus?: Record<string, React.ReactNode>;
  typeMenus?: Partial<Record<EntryType, React.ReactNode>>;
};

/**
 * The sidebar's Story Bible, its Entries grouped by Entry Type in the Story's order. When `reorderable`, each
 * Entry has a grip for dragging it within its own type, and each type's heading has one for moving the group.
 */
export function BibleList({ reorderable, ...props }: ListProps & { reorderable: boolean }) {
  if (reorderable) return <SortableBibleList {...props} />;
  const { storyId, entries, typeOrder, entryId, here, entryMenus } = props;
  return (
    <>
      {entryGroups(entries, typeOrder).map(({ type, entries: group }) => (
        <div key={type} className={styles.group}>
          <h3 className="smallcaps">{ENTRY_GROUP_LABEL[type]}</h3>
          <ul className={styles.list}>
            {group.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <EntryLink storyId={storyId} entry={entry} current={entry.id === entryId} here={here} />
                {entryMenus && <span className={styles.itemMenu}>{entryMenus[entry.id]}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    "To reorder an Entry or an Entry Type, press Space or Enter to pick it up. Use the arrow keys to move it, then Space or Enter to drop it, or Escape to cancel. Entries move within their own type.",
};

// A dragged type folds to its heading after the drag starts, so the drop targets are measured again as it moves.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

/** Sortable ids: a type is `type:<type>`, an Entry its own uuid. Each list's id lets only its own items take a drop. */
const TYPES_LIST = "types";
const typeId = (type: EntryType) => `type:${type}`;
const typeOf = (id: UniqueIdentifier) =>
  String(id).startsWith("type:") ? (String(id).slice("type:".length) as EntryType) : null;
const entriesList = (type: EntryType) => `entries:${type}`;

/**
 * Drops reorder at once and revert if the move fails. While a drag is under way, the Bible stays as it was
 * when the drag began, so another Co-host's change can't shift rows under the pointer.
 */
function SortableBibleList({ storyId, entries, typeOrder, entryId, here, entryMenus, typeMenus }: ListProps) {
  const dndId = useId();
  const [optimistic, setOptimistic] = useOptimistic<Order>({ typeOrder, entries });
  const [drag, setDrag] = useState<{ id: UniqueIdentifier; snapshot: Order } | null>(null);
  const [error, setError] = useState<ActionResult>(null);
  const [, startTransition] = useTransition();
  // dnd-kit announces from an effect, after the drop has already reordered the list.
  const dropMessage = useRef("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const order = drag?.snapshot ?? optimistic;
  const groups = entryGroups(order.entries, order.typeOrder);
  const types = groups.map((g) => g.type);
  const entryOf = (id: UniqueIdentifier) => order.entries.find((e) => e.id === id);
  const siblings = (type: EntryType) => order.entries.filter((e) => e.type === type);

  const draggedType = drag ? typeOf(drag.id) : null;
  const draggedEntry = drag && !draggedType ? entryOf(drag.id) : undefined;
  const dragList = draggedType ? TYPES_LIST : draggedEntry ? entriesList(draggedEntry.type) : null;

  const nameOf = (id: UniqueIdentifier) => {
    const type = typeOf(id);
    return type ? ENTRY_GROUP_LABEL[type] : (entryOf(id)?.name ?? "Entry");
  };
  const placeOf = (id: UniqueIdentifier) => {
    const type = typeOf(id);
    if (type) return `position ${types.indexOf(type) + 1} of ${types.length}`;
    const entry = entryOf(id);
    if (!entry) return "an unknown place";
    return `${ENTRY_GROUP_LABEL[entry.type]} ${siblings(entry.type).indexOf(entry) + 1}`;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${placeOf(over.id)}.` : `${nameOf(active.id)} is outside the list.`,
    onDragEnd: () => dropMessage.current,
    onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(active.id)} stayed at ${placeOf(active.id)}.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null);
    const type = typeOf(active.id);
    const entry = type ? undefined : entryOf(active.id);
    const ids: UniqueIdentifier[] = type ? types.map(typeId) : entry ? siblings(entry.type).map((e) => e.id) : [];
    const from = ids.indexOf(active.id);
    const to = over ? ids.indexOf(over.id) : -1;
    if (from < 0 || to < 0 || from === to) {
      dropMessage.current = `${nameOf(active.id)} stayed at ${placeOf(active.id)}.`;
      return;
    }

    let next: Order;
    let move: () => Promise<ActionResult>;
    if (type) {
      const after = afterId(arrayMove(types, from, to), to);
      dropMessage.current = `${ENTRY_GROUP_LABEL[type]} moved to position ${to + 1} of ${types.length}.`;
      next = { ...order, typeOrder: placeAfter(order.typeOrder, type, after) };
      move = () => moveEntryType(storyId, type, after);
    } else if (entry) {
      const moved = arrayMove(siblings(entry.type), from, to);
      const after = afterId(moved.map((e) => e.id), to);
      dropMessage.current = `${entry.name} moved to ${ENTRY_GROUP_LABEL[entry.type]} ${to + 1}.`;
      next = { ...order, entries: [...order.entries.filter((e) => e.type !== entry.type), ...moved] };
      move = () => moveEntryTo(storyId, entry.id, after);
    } else {
      return;
    }
    startTransition(async () => {
      setOptimistic(next);
      setError(await move());
    });
  };

  const onlyFor = (list: string) => ({ draggable: false, droppable: dragList !== null && dragList !== list });

  return (
    <>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        measuring={MEASURING}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        onDragStart={({ active }) => {
          setError(null);
          setDrag({ id: active.id, snapshot: optimistic });
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <SortableContext
          id={TYPES_LIST}
          items={types.map(typeId)}
          strategy={verticalListSortingStrategy}
          disabled={onlyFor(TYPES_LIST)}
        >
          {groups.map(({ type, entries: group }) => (
            <SortableGroup key={type} type={type} count={group.length} menu={typeMenus?.[type]}>
              <SortableContext
                id={entriesList(type)}
                items={group.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
                disabled={onlyFor(entriesList(type))}
              >
                <ul className={styles.list}>
                  {group.map((entry) => (
                    <SortableEntry
                      key={entry.id}
                      storyId={storyId}
                      entry={entry}
                      current={entry.id === entryId}
                      here={here}
                      menu={entryMenus?.[entry.id]}
                    />
                  ))}
                </ul>
              </SortableContext>
            </SortableGroup>
          ))}
        </SortableContext>
        <DragOverlay>
          {draggedType ? (
            <GroupHead
              type={draggedType}
              count={siblings(draggedType).length}
              className={styles.lifted}
              grip={
                <span className={styles.groupGrip} aria-hidden>
                  <GripIcon />
                </span>
              }
            />
          ) : draggedEntry ? (
            <div className={`${styles.item} ${styles.sortable} ${styles.lifted}`}>
              <div className={`${styles.row} ${styles.entryRow}`}>
                <EntryRowBody entry={draggedEntry} here={here} />
              </div>
              <span className={`${styles.grip} ${styles.entryGrip}`} aria-hidden>
                <GripIcon />
              </span>
            </div>
          ) : null}
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

/** While it's dragged, the group folds to its heading and Entry count. */
function SortableGroup({
  type,
  count,
  menu,
  children,
}: {
  type: EntryType;
  count: number;
  menu?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: typeId(type),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${styles.group} ${isDragging ? `${styles.foldedGroup} ${styles.placeholder}` : ""}`}
    >
      <GroupHead
        type={type}
        count={isDragging ? count : undefined}
        menu={isDragging ? undefined : menu}
        grip={
          <button
            ref={setActivatorNodeRef}
            type="button"
            className={styles.groupGrip}
            aria-label={`Reorder ${ENTRY_GROUP_LABEL[type]}`}
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
        }
      />
      {!isDragging && children}
    </div>
  );
}

/** A reorderable group's heading. A `count` shows it folded. */
function GroupHead({
  type,
  count,
  grip,
  menu,
  className = "",
}: {
  type: EntryType;
  count?: number;
  grip: React.ReactNode;
  menu?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${styles.groupHead} ${count !== undefined ? styles.folded : ""} ${className}`}>
      {grip}
      <h3 className="smallcaps">{ENTRY_GROUP_LABEL[type]}</h3>
      {count !== undefined && (
        <span className={styles.count}>
          {count}
          <span className="sr-only"> {count === 1 ? "Entry" : "Entries"}</span>
        </span>
      )}
      {menu && <span className={styles.itemMenu}>{menu}</span>}
    </div>
  );
}

type RowProps = { storyId: string; entry: Entry; current: boolean; here: HereNow[] };

function SortableEntry({ menu, ...row }: RowProps & { menu?: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.entry.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${styles.item} ${styles.sortable} ${isDragging ? styles.placeholder : ""}`}
    >
      <EntryLink {...row} />
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={`${styles.grip} ${styles.entryGrip}`}
        aria-label={`Reorder ${row.entry.name}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      {menu && <span className={styles.itemMenu}>{menu}</span>}
    </li>
  );
}

function EntryLink({ storyId, current, ...body }: RowProps) {
  return (
    <Link
      href={`/stories/${storyId}/bible/${body.entry.id}`}
      scroll={false}
      className={`${styles.row} ${styles.entryRow}`}
      aria-current={current ? "page" : undefined}
    >
      <EntryRowBody {...body} />
    </Link>
  );
}

function EntryRowBody({ entry, here }: { entry: Entry; here: HereNow[] }) {
  const inside = here.filter((h) => h.kind === "entry" && h.documentId === entry.id);
  return (
    <>
      <span className={styles.name}>{entry.name}</span>
      {inside.length > 0 && (
        <span className={styles.meta}>
          <PresenceDots here={inside} />
        </span>
      )}
    </>
  );
}
