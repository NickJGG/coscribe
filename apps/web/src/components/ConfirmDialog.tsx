"use client";

import { useEffect, useRef } from "react";
import { Modal } from "./Modal";
import styles from "./ConfirmDialog.module.css";

export type Confirm = { title: string; body?: string; action: string; danger?: boolean };

/**
 * Asks before an action: `title` is the question, `action` the verb on its button. Focus starts on Cancel,
 * so an Enter pressed by accident does nothing.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  body,
  action,
  danger,
  pending,
  error,
  returnTo,
}: Confirm & {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  pending?: boolean;
  error?: string | null;
  returnTo?: () => HTMLElement | null;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // After Modal's showModal(), which focuses its × first.
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} title={title} returnTo={returnTo} size="compact" role="alertdialog">
      <div className={styles.body}>
        {body && <p className="muted">{body}</p>}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className="button button-small" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`button button-small ${danger ? "button-danger" : "button-primary"}`}
            disabled={pending}
            onClick={onConfirm}
          >
            {action}
          </button>
        </div>
      </div>
    </Modal>
  );
}
