"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import styles from "./Modal.module.css";

/**
 * A modal dialog on native `<dialog>`: focus stays inside, the page behind is inert, and Esc, ×, or a click
 * outside it closes it.
 * Focus goes back to whatever opened it. Full screen on phones. Its children render only while it's open.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const pressedOutside = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [open]);

  if (typeof document === "undefined") return null;

  // On the body, so a hidden toolbar or panel around the opener can't hide it too.
  return createPortal(
    <dialog
      ref={ref}
      className={styles.modal}
      aria-labelledby={headingId}
      onClose={(e) => {
        // A close queued by the effect's cleanup can land after it has reopened (StrictMode remounts).
        if (!e.currentTarget.open) onClose();
      }}
      onPointerDown={(e) => {
        pressedOutside.current = isOutside(e);
      }}
      onClick={(e) => {
        // Both ends outside, so a text selection dragged past the edge doesn't close it.
        if (pressedOutside.current && isOutside(e)) onClose();
        pressedOutside.current = false;
      }}
      onKeyDown={(e) => {
        // Not the desk's Escape (find, comparison).
        if (e.key === "Escape") e.stopPropagation();
      }}
    >
      {open && (
        <>
          <header className={styles.head}>
            <div className={styles.titles}>
              {eyebrow && <span className={`smallcaps ${styles.eyebrow}`}>{eyebrow}</span>}
              <h2 id={headingId} className={styles.heading}>
                {title}
              </h2>
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label={`Close ${title}`}>
              <CloseIcon className={styles.closeIcon} />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
        </>
      )}
    </dialog>,
    document.body
  );
}

/** The backdrop belongs to the dialog itself, so a click there targets the dialog, outside its box. */
function isOutside(e: React.MouseEvent<HTMLDialogElement>): boolean {
  if (e.target !== e.currentTarget) return false;
  const box = e.currentTarget.getBoundingClientRect();
  return e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
}
