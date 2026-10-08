"use client";

import Link from "next/link";
import { Badge } from "./Badge";
import { Dropdown } from "./Dropdown";
import { MarkAllReadButton, NotificationItem, useNotifications } from "./Notifications";
import headerStyles from "./SiteHeader.module.css";
import styles from "./Notifications.module.css";

/** The bell. Opening it marks nothing read: items are read when clicked, or with "Mark all read". */
export function NotificationsMenu() {
  const { latest, unread } = useNotifications();
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
      <div className={headerStyles.panelHead}>
        <h2>Notifications</h2>
        <MarkAllReadButton className={styles.markAll} />
      </div>
      <div className={headerStyles.panelBody}>
        {latest.length ? (
          <div className={styles.list}>
            {latest.map((n) => (
              <NotificationItem key={n.id} notification={n} />
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
    </Dropdown>
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
