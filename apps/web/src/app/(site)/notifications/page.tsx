import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { NOTIFICATION_COLUMNS, PAGE_SIZE } from "@/lib/notifications";
import { MarkAllReadOnVisit, NotificationItem } from "@/components/Notifications";
import styles from "./notifications.module.css";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage(props: PageProps<"/notifications">) {
  await requireProfile("/notifications");
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  // One extra row says whether there's a next page.
  const { data } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE);
  const notifications = (data ?? []).slice(0, PAGE_SIZE);
  const hasNext = (data ?? []).length > PAGE_SIZE;

  return (
    <div className="page">
      <div className={styles.head}>
        <h1>Notifications</h1>
        <MarkAllReadOnVisit />
      </div>

      {notifications.length ? (
        <div className={styles.list}>
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} highlighted={!n.read_at} />
          ))}
        </div>
      ) : (
        <p className="muted">{page > 1 ? "Nothing further back." : "Nothing yet. Invites, friend requests and news from your Stories land here."}</p>
      )}

      {(page > 1 || hasNext) && (
        <nav className={styles.pager} aria-label="Pages">
          {page > 1 ? (
            <Link href={page === 2 ? "/notifications" : `/notifications?page=${page - 1}`} className="button button-small">
              &larr; Newer
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link href={`/notifications?page=${page + 1}`} className="button button-small">
              Older &rarr;
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
