"use client";

import styles from "./UndoToast.module.css";

/**
 * A card offering to Undo what was just done. It drains over a few seconds, paused while hovered or
 * focused, then calls `onExpire`. Give it a fresh `key` for each new action so the timer restarts.
 */
export function UndoToast({
  children,
  onUndo,
  onExpire,
  className,
}: {
  children: React.ReactNode;
  onUndo: () => void;
  onExpire: () => void;
  className?: string;
}) {
  return (
    <div className={`${styles.toast} ${className ?? ""}`} role="status">
      <span className={styles.message}>{children}</span>
      <button type="button" className={`button button-ghost ${styles.undo}`} onClick={onUndo}>
        Undo
      </button>
      <span className={styles.timer} onAnimationEnd={onExpire} />
    </div>
  );
}
