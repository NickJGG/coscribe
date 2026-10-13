"use client";

import { documentName, OUTLINE_FIELDS } from "@coscribe/editor";
import { Bar } from "../Skeleton";
import { Modal } from "../Modal";
import { useLiveSession } from "../SyncSocket";
import { OutlineField } from "./OutlineField";
import styles from "./outline.module.css";

/** A Chapter's Outline, live while open. apps/sync makes it read-only when the Chapter is Locked or the Story Finished. */
export function OutlineDialog({ chapterId, eyebrow, onClose }: { chapterId: string; eyebrow: string; onClose: () => void }) {
  const { session, connection, synced, readOnly } = useLiveSession(documentName("outline", chapterId));

  return (
    <Modal open onClose={onClose} title="Outline" eyebrow={eyebrow}>
      {connection === "denied" ? (
        <p className={styles.denied} role="status">
          You can no longer open this Outline.
        </p>
      ) : session && synced ? (
        <div className={styles.fields}>
          {OUTLINE_FIELDS.map((field) => (
            <OutlineField key={field.id} chapterId={chapterId} field={field} session={session} readOnly={readOnly} />
          ))}
        </div>
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
