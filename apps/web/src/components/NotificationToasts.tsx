"use client";

import { useLayoutEffect, useRef } from "react";
import { NotificationItem, useNotifications } from "./Notifications";
import styles from "./NotificationToasts.module.css";

const HEADER_GAP = 8;
const FALLBACK_TOP = 64;

/**
 * New Notifications as cards under the header's right end. Each drains over a few seconds (hovering the
 * stack pauses it); clicking one marks it read, while × and timing out leave it unread.
 */
export function NotificationToasts() {
  const { toasts, dismissToast, markRead } = useNotifications();
  const stackRef = useRef<HTMLDivElement>(null);

  // Shells' headers differ in height, and the site header scrolls away.
  useLayoutEffect(() => {
    if (!toasts.length || !stackRef.current) return;
    const header = document.querySelector("header");
    const top = header ? Math.max(header.getBoundingClientRect().bottom, 0) + HEADER_GAP : FALLBACK_TOP;
    stackRef.current.style.top = `${top}px`;
  }, [toasts]);

  return (
    <div ref={stackRef} className={styles.stack} aria-live="polite">
      {toasts.map((n) => (
        <div
          key={n.id}
          className={styles.toast}
          onClick={(e) => {
            const target = (e.target as Element).closest("a, button");
            if (!target || target.hasAttribute("data-dismiss")) return;
            void markRead(n.id);
            // An invite's form must stay mounted for its Server Action to submit.
            if (target.tagName === "A") dismissToast(n.id);
          }}
        >
          <NotificationItem notification={n} highlighted={false} />
          <button
            type="button"
            className={styles.close}
            aria-label="Dismiss"
            data-dismiss
            onClick={() => dismissToast(n.id)}
          >
            &times;
          </button>
          <span className={styles.timer} onAnimationEnd={() => dismissToast(n.id)} />
        </div>
      ))}
    </div>
  );
}
