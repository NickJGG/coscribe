"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import {
  addedFields,
  addField,
  discardField,
  documentName,
  OUTLINE_FIELDS,
  outlineCharacters,
  outlineHasContent,
  removeField,
  renameField,
  restoreField,
  type RemovedField,
} from "@coscribe/editor";
import type { EntryMentionEntry } from "@/lib/entries";
import { Bar } from "../Skeleton";
import { Modal } from "../Modal";
import { UndoToast } from "../UndoToast";
import { useLiveSession, type LiveSession } from "../SyncSocket";
import type { StoryAuthor, Writer } from "../LiveDocument";
import { OutlineCharacters } from "./OutlineCharacters";
import { OutlineEntryCard } from "./OutlineEntryCard";
import { NEW_FIELD, OutlineField } from "./OutlineField";
import styles from "./outline.module.css";

const [SUMMARY, ...REST] = OUTLINE_FIELDS;

/**
 * A Chapter's Outline, live while open. apps/sync makes it read-only when the Chapter is Locked or the Story
 * Finished. A Character chip opens that Entry's card beside it, with the Entry's own rights, `entryEditable`.
 */
export function OutlineDialog({
  storyId,
  chapterId,
  eyebrow,
  characters,
  entryEditable,
  writer,
  authors,
  onContent,
  onClose,
}: {
  storyId: string;
  chapterId: string;
  eyebrow: string;
  /** The Story's Character Entries. */
  characters: EntryMentionEntry[];
  entryEditable: boolean;
  writer: Writer | null;
  authors: StoryAuthor[];
  onContent: (hasContent: boolean) => void;
  onClose: () => void;
}) {
  const { session, connection, synced, readOnly } = useLiveSession(documentName("outline", chapterId));
  const gone = connection === "denied" || connection === "trashed";
  const live = !gone && session && synced ? session : null;
  const lists = useOutlineLists(live?.ydoc ?? null);
  const [openId, setOpenId] = useState<string | null>(null);
  const openEntry = openId && lists.characterIds.includes(openId) ? characters.find((c) => c.id === openId) : undefined;
  // Its chip was removed, or its Entry deleted or retyped: the card goes, and re-adding doesn't bring it back.
  if (openId && !openEntry) setOpenId(null);
  // One Undo at a time: removing another field, or closing, gives up the last one's.
  const [removed, setRemoved] = useState<RemovedField | null>(null);

  const discardRemoved = () => {
    if (removed && session) discardField(session.ydoc, removed.field.id);
  };

  const close = () => {
    discardRemoved();
    onClose();
  };

  useEffect(() => {
    if (!session || !synced) return;
    const { ydoc } = session;
    const update = () => onContent(outlineHasContent(ydoc));
    update();
    ydoc.on("update", update);
    return () => ydoc.off("update", update);
  }, [session, synced, onContent]);

  return (
    <Modal
      open
      onClose={close}
      title="Outline"
      eyebrow={eyebrow}
      aside={
        openEntry ? (
          <OutlineEntryCard
            key={openEntry.id}
            storyId={storyId}
            entry={openEntry}
            editable={entryEditable}
            writer={writer}
            authors={authors}
            onClose={() => setOpenId(null)}
          />
        ) : null
      }
      onEscape={() => {
        if (!openId) return false;
        setOpenId(null);
        return true;
      }}
    >
      {gone ? (
        <p className={styles.denied} role="status">
          You can no longer open this Outline.
        </p>
      ) : live ? (
        <Fields
          storyId={storyId}
          chapterId={chapterId}
          session={live}
          readOnly={readOnly}
          lists={lists}
          characters={characters}
          openId={openId}
          onOpen={setOpenId}
          removed={removed}
          onRemove={(id) => {
            discardRemoved();
            setRemoved(removeField(live.ydoc, id));
          }}
          onUndone={() => setRemoved(null)}
        />
      ) : (
        <div className={styles.fields} aria-label="Loading the Outline" role="status">
          {OUTLINE_FIELDS.map((field) => (
            <div key={field.id} className={styles.field}>
              <span className="smallcaps">
                <Bar width="9em" />
              </span>
              <Bar width="100%" height="calc(4.8rem + 18px)" />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Fields({
  storyId,
  chapterId,
  session,
  readOnly,
  lists: { added, characterIds },
  characters,
  openId,
  onOpen,
  removed,
  onRemove,
  onUndone,
}: {
  storyId: string;
  chapterId: string;
  session: LiveSession;
  readOnly: boolean;
  lists: OutlineLists;
  characters: EntryMentionEntry[];
  openId: string | null;
  onOpen: (id: string | null) => void;
  removed: RemovedField | null;
  onRemove: (id: string) => void;
  /** The toast is gone, by Undo or by expiring. */
  onUndone: () => void;
}) {
  const { ydoc } = session;
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const fieldProps = { chapterId, session, readOnly };

  return (
    <>
      <div className={styles.fields}>
        {SUMMARY && <OutlineField {...fieldProps} field={SUMMARY} />}
        <OutlineCharacters
          storyId={storyId}
          ydoc={ydoc}
          ids={characterIds}
          characters={characters}
          readOnly={readOnly}
          openId={openId}
          onOpen={onOpen}
        />
        {REST.map((field) => (
          <OutlineField key={field.id} {...fieldProps} field={field} />
        ))}
        {added.map((field) => (
          <OutlineField
            key={field.id}
            {...fieldProps}
            field={field}
            focusLabel={field.id === justAdded}
            onRename={(label) => renameField(ydoc, field.id, label)}
            onRemove={() => onRemove(field.id)}
          />
        ))}
        {!readOnly && (
          <button
            type="button"
            className={styles.add}
            onClick={() => setJustAdded(addField(ydoc, NEW_FIELD))}
          >
            + Add a field
          </button>
        )}
      </div>
      {removed && !readOnly && (
        <UndoToast
          key={removed.field.id}
          className={styles.toast}
          onUndo={() => {
            restoreField(ydoc, removed);
            onUndone();
          }}
          onExpire={() => {
            discardField(ydoc, removed.field.id);
            onUndone();
          }}
        >
          Removed &ldquo;{removed.field.label}&rdquo;
        </UndoToast>
      )}
    </>
  );
}

type OutlineLists = { added: ReturnType<typeof addedFields>; characterIds: string[] };

function readLists(ydoc: Y.Doc | null): OutlineLists {
  return ydoc ? { added: addedFields(ydoc), characterIds: outlineCharacters(ydoc) } : { added: [], characterIds: [] };
}

function useOutlineLists(ydoc: Y.Doc | null) {
  const [seen, setSeen] = useState(ydoc);
  const [lists, setLists] = useState(() => readLists(ydoc));
  // Read at once, not after an effect, so the fields don't arrive a frame late.
  if (seen !== ydoc) {
    setSeen(ydoc);
    setLists(readLists(ydoc));
  }

  useEffect(() => {
    if (!ydoc) return;
    const update = () => setLists(readLists(ydoc));
    const fields = ydoc.getArray("fields");
    const characters = ydoc.getArray("characters");
    update();
    fields.observeDeep(update);
    characters.observe(update);
    return () => {
      fields.unobserveDeep(update);
      characters.unobserve(update);
    };
  }, [ydoc]);

  return lists;
}
