"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/relative-time";
import {
  isViewerInvite,
  loadLatestNotifications,
  NOTIFICATION_COLUMNS,
  notificationActor,
  notificationHref,
  notificationVerb,
  type LatestNotifications,
  type Notification,
} from "@/lib/notifications";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { ActionForm } from "./ActionForm";
import { Avatar } from "./Avatar";
import { NotificationToasts } from "./NotificationToasts";
import styles from "./Notifications.module.css";

type NotificationsValue = LatestNotifications & {
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  toasts: Notification[];
  dismissToast: (id: string) => void;
};

type QuietToasts = {
  setBellOpen: (open: boolean) => void;
  setChatOpenFor: (storyId: string | null) => void;
};

const MAX_TOASTS = 3;

const NotificationsContext = createContext<NotificationsValue | null>(null);
const QuietToastsContext = createContext<QuietToasts | null>(null);

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
  const [toasts, setToasts] = useState<Notification[]>([]);
  const shown = useRef(new Set<string>());
  const bellOpen = useRef(false);
  const chatOpenFor = useRef<string | null>(null);

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
    // The payload has no actor join, so a toast needs the row fetched.
    const toast = async (id: string) => {
      const { data: n } = await supabase.from("notifications").select(NOTIFICATION_COLUMNS).eq("id", id).maybeSingle();
      if (!live || !n || bellOpen.current) return;
      if (n.kind === "chat_mention" && n.story_id === chatOpenFor.current) return;
      setToasts((current) => [n, ...current.filter((t) => t.id !== n.id)].slice(0, MAX_TOASTS));
    };
    const filter = `recipient_id=eq.${userId}`;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on<{ id: string }>("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter }, ({ new: n }) => {
        void load();
        if (n.id) void toast(n.id);
      })
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

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setState((current) => ({ latest: current.latest.map((n) => ({ ...n, read_at: n.read_at ?? readAt })), unread: 0 }));
    await supabase.rpc("mark_notifications_read");
  }, [supabase]);

  const markRead = useCallback(
    async (id: string) => {
      const readAt = new Date().toISOString();
      setState((current) => {
        if (!current.latest.some((n) => n.id === id && !n.read_at)) return current;
        return {
          latest: current.latest.map((n) => (n.id === id ? { ...n, read_at: readAt } : n)),
          unread: Math.max(0, current.unread - 1),
        };
      });
      await supabase.rpc("mark_notification_read", { p_id: id });
    },
    [supabase]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ ...state, markAllRead, markRead, toasts, dismissToast }),
    [state, markAllRead, markRead, toasts, dismissToast]
  );

  const quiet = useMemo<QuietToasts>(
    () => ({
      setBellOpen: (open) => {
        bellOpen.current = open;
      },
      setChatOpenFor: (storyId) => {
        chatOpenFor.current = storyId;
      },
    }),
    []
  );

  return (
    <NotificationsContext value={value}>
      <QuietToastsContext value={quiet}>
        {children}
        <NotificationToasts />
      </QuietToastsContext>
    </NotificationsContext>
  );
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications needs a NotificationsProvider");
  return value;
}

/** Lets the bell and Story Chat hold off toasts that would repeat what's already on screen. Null when signed out. */
export function useQuietToasts() {
  return useContext(QuietToastsContext);
}

/**
 * One Notification, linking to what it's about while that still exists. Invites carry Join and Decline.
 * `highlighted` marks it as new to whoever opened the list, whether or not it has since been read.
 */
export function NotificationItem({ notification: n, highlighted }: { notification: Notification; highlighted: boolean }) {
  const href = notificationHref(n);
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
      {highlighted && <span className={styles.unreadDot} aria-label="New" />}
    </>
  );

  if (inviteId) {
    return (
      <div className={styles.item} data-unread={highlighted || undefined}>
        {body}
        <span className={styles.actions}>
          <ActionForm action={deleteInvite.bind(null, inviteId)}>
            <button className="button button-ghost button-tiny">Decline</button>
          </ActionForm>
          <ActionForm action={acceptInvite.bind(null, inviteId)}>
            <button className="button button-primary button-tiny">
              {isViewerInvite(n) ? "Join as Viewer" : "Join as Writer"}
            </button>
          </ActionForm>
        </span>
      </div>
    );
  }

  return href ? (
    <Link href={href} className={styles.item} data-unread={highlighted || undefined}>
      {body}
    </Link>
  ) : (
    <div className={styles.item} data-unread={highlighted || undefined}>
      {body}
    </div>
  );
}

/** Marks every Notification read once, on mount: what the page showed unread stays highlighted from its render. */
export function MarkAllReadOnVisit() {
  const { markAllRead } = useNotifications();
  useEffect(() => {
    void markAllRead();
  }, [markAllRead]);
  return null;
}
