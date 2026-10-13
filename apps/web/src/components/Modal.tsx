"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import styles from "./Modal.module.css";

/**
 * A modal dialog on native `<dialog>`: focus stays inside, the page behind is inert, and Esc, ×, or a click
 * outside it closes it.
 * Focus goes back to whatever opened it. Full screen on phones. Its children render only while it's open.
 *
 * Passing `aside` (even null) makes it a companion layout: a transparent layer over the window holding the
 * dialog's box, always centered, and the aside's own box to its left. Where both don't fit, the aside covers
 * the box, and a `data-modal-back` element inside the aside shows only then. A click on the layer outside
 * both closes it. `onEscape` returning true means it handled Esc, and the dialog stays open.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  aside,
  onEscape,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  onEscape?: () => boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const pressedOutside = useRef(false);
  const companion = aside !== undefined;
  const outside = companion ? isLayer : isOutside;

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

  const content = (
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
  );

  // On the body, so a hidden toolbar or panel around the opener can't hide it too.
  return createPortal(
    <dialog
      ref={ref}
      className={companion ? styles.layer : styles.modal}
      aria-labelledby={headingId}
      data-aside={(companion && aside != null) || undefined}
      onClose={(e) => {
        // A close queued by the effect's cleanup can land after it has reopened (StrictMode remounts).
        if (!e.currentTarget.open) onClose();
      }}
      onPointerDown={(e) => {
        pressedOutside.current = outside(e);
      }}
      onClick={(e) => {
        // Both ends outside, so a text selection dragged past the edge doesn't close it.
        if (pressedOutside.current && outside(e)) onClose();
        pressedOutside.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        // Not the desk's Escape (find, comparison).
        e.stopPropagation();
        if (!e.defaultPrevented && onEscape?.()) e.preventDefault();
      }}
    >
      {open &&
        (companion ? (
          <>
            <div className={styles.box}>
              {content}
            </div>
            {aside != null && <div className={styles.aside}>{aside}</div>}
          </>
        ) : (
          content
        ))}
    </dialog>,
    document.body
  );
}

/** In companion mode the dialog is the transparent layer, so only a click on the layer itself is outside. */
function isLayer(e: React.MouseEvent<HTMLDialogElement>): boolean {
  return e.target === e.currentTarget;
}

/** The backdrop belongs to the dialog itself, so a click there targets the dialog, outside its box. */
function isOutside(e: React.MouseEvent<HTMLDialogElement>): boolean {
  if (e.target !== e.currentTarget) return false;
  const box = e.currentTarget.getBoundingClientRect();
  return e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom;
}
