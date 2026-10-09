"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "./Badge";
import { Dropdown, useDropdownOpen } from "./Dropdown";
import { NotificationItem, useNotifications } from "./Notifications";
import headerStyles from "./SiteHeader.module.css";
import styles from "./Notifications.module.css";

/**
 * The bell. Opening it marks every Notification read, and anything arriving while it's open too; what was
 * unread stays highlighted until it closes.
 */
export function NotificationsMenu() {
  const { unread } = useNotifications();
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <Dropdown
      label={label}
      triggerClassName={headerStyles.iconButton}
      panelClassName={headerStyles.panel}
      trigger={
        <>
          <BellIcon />
          <Badge count={unread} />
        </>
      }
    >
      <NotificationsPanel />
    </Dropdown>
  );
}

function NotificationsPanel() {
  const open = useDropdownOpen();
  const { latest, unread, markAllRead } = useNotifications();
  const [wasOpen, setWasOpen] = useState(open);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  // Taken during render, before markAllRead's optimistic update clears read_at's evidence.
  const unreadShown = latest.filter((n) => !n.read_at).map((n) => n.id);
  if (open !== wasOpen) {
    setWasOpen(open);
    setFresh(new Set(open ? unreadShown : []));
  } else if (open && unreadShown.some((id) => !fresh.has(id))) {
    setFresh(new Set([...fresh, ...unreadShown]));
  }

  useEffect(() => {
    if (open && unread > 0) void markAllRead();
  }, [open, unread, markAllRead]);

  return (
    <>
      <div className={headerStyles.panelHead}>
        <h2>Notifications</h2>
      </div>
      <div className={headerStyles.panelBody}>
        {latest.length ? (
          <div className={styles.list}>
            {latest.map((n) => (
              <NotificationItem key={n.id} notification={n} highlighted={fresh.has(n.id)} />
            ))}
          </div>
        ) : (
          <p className={`muted ${styles.empty}`}>You&rsquo;re all caught up.</p>
        )}
      </div>
      {latest.length > 0 && (
        <div className={`${headerStyles.panelFoot} ${styles.foot}`}>
          <Link href="/notifications">See all &rarr;</Link>
        </div>
      )}
    </>
  );
}

function BellIcon() {
  return (
    <svg className={headerStyles.icon} viewBox="0 0 20 20" aria-hidden>
      <path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5.5 2 6H3c.5-.5 2-2 2-6Z" />
      <path d="M8.2 17a2 2 0 0 0 3.6 0" />
    </svg>
  );
}
