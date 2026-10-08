"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/relative-time";
import {
  loadLatestNotifications,
  notificationActor,
  notificationHref,
  notificationVerb,
  type LatestNotifications,
  type Notification,
} from "@/lib/notifications";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { ActionForm } from "./ActionForm";
import { Avatar } from "./Avatar";
import styles from "./Notifications.module.css";

type NotificationsValue = LatestNotifications & {
  markRead: (id: string) => void;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * The signed-in User's newest Notifications and unread count, live from `notifications`. Mounted in the
 * root layout so one subscription lasts across every shell.
 */
export function NotificationsProvider({
  userId,
  initial,
  children,
}: {
  userId: string;
  initial: LatestNotifications;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initial);
  const shown = useRef(new Set<string>());

  useEffect(() => {
    shown.current = new Set(state.latest.map((n) => n.id));
  }, [state.latest]);

  // Subscribe first and load once subscribed, so nothing that changes in between is missed.
  useEffect(() => {
    let live = true;
    const load = async () => {
      const next = await loadLatestNotifications(supabase);
      if (live) setState(next);
    };
    const filter = `recipient_id=eq.${userId}`;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter }, load)
      // Realtime can't filter deletes, so each brings only an id: reload only for one we're showing.
      .on<{ id: string }>("postgres_changes", { event: "DELETE", schema: "public", table: "notifications" }, ({ old }) => {
        if (old.id && shown.current.has(old.id)) void load();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const markRead = useCallback(
    (id: string) => {
      const readAt = new Date().toISOString();
      setState((current) => {
        const wasUnread = current.latest.some((n) => n.id === id && !n.read_at);
        return {
          latest: current.latest.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: readAt } : n)),
          unread: wasUnread ? Math.max(0, current.unread - 1) : current.unread,
        };
      });
      void supabase.from("notifications").update({ read_at: readAt }).eq("id", id).is("read_at", null);
    },
    [supabase]
  );

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setState((current) => ({ latest: current.latest.map((n) => ({ ...n, read_at: n.read_at ?? readAt })), unread: 0 }));
    await supabase.rpc("mark_notifications_read");
  }, [supabase]);

  const value = useMemo(() => ({ ...state, markRead, markAllRead }), [state, markRead, markAllRead]);

  return <NotificationsContext value={value}>{children}</NotificationsContext>;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications needs a NotificationsProvider");
  return value;
}

/**
 * One Notification. Clicking it marks it read; it links to what it's about while that still exists.
 * Invites carry Join and Decline.
 */
export function NotificationItem({ notification: n }: { notification: Notification }) {
  const { markRead } = useNotifications();
  // The "See all" page is server-rendered, so it remembers its own clicks.
  const [readHere, setReadHere] = useState(false);
  const unread = !n.read_at && !readHere;
  const href = notificationHref(n);
  const read = () => {
    if (!unread) return;
    setReadHere(true);
    markRead(n.id);
  };

  const inviteId = n.kind === "invite_received" ? n.invite_id : null;
  const body = (
    <>
      {n.actor ? <Avatar name={n.actor.username} color={n.actor.author_color} /> : <span />}
      <span className={styles.text}>
        <span>
          <b>{notificationActor(n)}</b> {notificationVerb(n)}{" "}
          {inviteId && href ? (
            <Link href={href} className={styles.story}>
              {n.story_title}
            </Link>
          ) : (
            <span className={styles.story}>{n.story_title}</span>
          )}
        </span>
        <time dateTime={n.created_at} className={styles.when} suppressHydrationWarning>
          {relativeTime(Date.parse(n.created_at))}
        </time>
      </span>
      {unread && <span className={styles.unreadDot} aria-label="Unread" />}
    </>
  );

  if (inviteId) {
    return (
      <div className={styles.item} data-unread={unread || undefined}>
        {body}
        <span className={styles.actions}>
          <ActionForm action={deleteInvite.bind(null, inviteId)}>
            <button className="button button-ghost button-tiny">Decline</button>
          </ActionForm>
          <ActionForm action={acceptInvite.bind(null, inviteId)}>
            <button className="button button-primary button-tiny">Join as Writer</button>
          </ActionForm>
        </span>
      </div>
    );
  }

  if (href) {
    return (
      <Link href={href} className={styles.item} data-unread={unread || undefined} onClick={read}>
        {body}
      </Link>
    );
  }

  return unread ? (
    <button type="button" className={styles.item} data-unread onClick={read}>
      {body}
    </button>
  ) : (
    <div className={styles.item}>{body}</div>
  );
}

export function MarkAllReadButton({ className, onDone }: { className?: string; onDone?: () => void }) {
  const { unread, markAllRead } = useNotifications();
  if (!unread) return null;

  return (
    <button type="button" className={className} onClick={() => void markAllRead().then(onDone)}>
      Mark all read
    </button>
  );
}
