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
import { Bar } from "../Skeleton";
import { Modal } from "../Modal";
import { UndoToast } from "../UndoToast";
import { useLiveSession, type LiveSession } from "../SyncSocket";
import { OutlineCharacters, type OutlineCharacter } from "./OutlineCharacters";
import { NEW_FIELD, OutlineField } from "./OutlineField";
import styles from "./outline.module.css";

const [SUMMARY, ...REST] = OUTLINE_FIELDS;

/** A Chapter's Outline, live while open. apps/sync makes it read-only when the Chapter is Locked or the Story Finished. */
export function OutlineDialog({
  storyId,
  chapterId,
  eyebrow,
  characters,
  onContent,
  onClose,
}: {
  storyId: string;
  chapterId: string;
  eyebrow: string;
  characters: OutlineCharacter[];
  onContent: (hasContent: boolean) => void;
  onClose: () => void;
}) {
  const { session, connection, synced, readOnly } = useLiveSession(documentName("outline", chapterId));
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
    <Modal open onClose={close} title="Outline" eyebrow={eyebrow}>
      {connection === "denied" ? (
        <p className={styles.denied} role="status">
          You can no longer open this Outline.
        </p>
      ) : session && synced ? (
        <Fields
          storyId={storyId}
          chapterId={chapterId}
          session={session}
          readOnly={readOnly}
          characters={characters}
          removed={removed}
          onRemove={(id) => {
            discardRemoved();
            setRemoved(removeField(session.ydoc, id));
          }}
          onUndone={() => setRemoved(null)}
          onClose={close}
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
  characters,
  removed,
  onRemove,
  onUndone,
  onClose,
}: {
  storyId: string;
  chapterId: string;
  session: LiveSession;
  readOnly: boolean;
  characters: OutlineCharacter[];
  removed: RemovedField | null;
  onRemove: (id: string) => void;
  /** The toast is gone, by Undo or by expiring. */
  onUndone: () => void;
  onClose: () => void;
}) {
  const { ydoc } = session;
  const { added, characterIds } = useOutlineLists(ydoc);
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
          onNavigate={onClose}
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

function readLists(ydoc: Y.Doc) {
  return { added: addedFields(ydoc), characterIds: outlineCharacters(ydoc) };
}

function useOutlineLists(ydoc: Y.Doc) {
  const [lists, setLists] = useState(() => readLists(ydoc));

  useEffect(() => {
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
