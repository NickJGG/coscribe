"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./StoryChat.module.css";

type Person = { id: string; username: string; author_color: string };
type Message = { id: string; user_id: string; body: string; created_at: string };

const PAGE = 50;
const COLUMNS = "id, user_id, body, created_at";
/** Consecutive messages from one Writer within this window share a single name line. */
const GROUP_MS = 5 * 60 * 1000;

function merge(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * The Story Chat side panel, rendered only for Writers and up. RLS keeps both history and Realtime
 * delivery to members, so a Writer removed mid-session simply stops receiving messages.
 */
export function StoryChat({ storyId, me, members }: { storyId: string; me: string; members: Person[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState(() => new Map(members.map((p) => [p.id, p])));
  const openRef = useRef(open);
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const loadLatest = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select(COLUMNS)
      .eq("story_id", storyId)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (error) return setError("Couldn't load the chat.");
    setError(null);
    setMessages((current) => merge(current, data));
    setHasEarlier((had) => had || data.length === PAGE);
  }, [supabase, storyId]);

  // Subscribe first and load once subscribed, so nothing sent in between is missed.
  useEffect(() => {
    const channel = supabase
      .channel(`story-chat:${storyId}`)
      .on<Message>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `story_id=eq.${storyId}` },
        ({ new: message }) => {
          setMessages((current) => merge(current, [message]));
          if (!openRef.current && message.user_id !== me) setUnread((n) => n + 1);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void loadLatest();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, storyId, me, loadLatest]);

  const missing = useMemo(
    () => [...new Set(messages.map((m) => m.user_id))].filter((id) => !people.has(id)),
    [messages, people]
  );

  // Writers who joined after this page loaded.
  useEffect(() => {
    if (!missing.length) return;
    void supabase
      .from("profiles")
      .select("id, username, author_color")
      .in("id", missing)
      .then(({ data }) => {
        if (data?.length) setPeople((current) => new Map([...current, ...data.map((p) => [p.id, p] as const)]));
      });
  }, [supabase, missing]);

  useEffect(() => {
    const list = listRef.current;
    if (open && list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  async function loadEarlier() {
    const oldest = messages[0];
    if (!oldest) return;
    const list = listRef.current;
    const fromBottom = list ? list.scrollHeight - list.scrollTop : 0;

    const { data, error } = await supabase
      .from("chat_messages")
      .select(COLUMNS)
      .eq("story_id", storyId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    if (error) return setError("Couldn't load earlier messages.");
    stickToBottom.current = false;
    setMessages((current) => merge(current, data));
    setHasEarlier(data.length === PAGE);
    requestAnimationFrame(() => {
      if (list) list.scrollTop = list.scrollHeight - fromBottom;
    });
  }

  async function send(form: HTMLFormElement) {
    const field = form.elements.namedItem("body") as HTMLTextAreaElement;
    const body = field.value.trim();
    if (!body) return;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ story_id: storyId, body })
      .select(COLUMNS)
      .single();
    if (error) return setError("Couldn't send. You may no longer be in this story.");
    setError(null);
    field.value = "";
    stickToBottom.current = true;
    setMessages((current) => merge(current, [data]));
  }

  function toggle() {
    stickToBottom.current = true;
    setUnread(0);
    setOpen((o) => !o);
  }

  return (
    <>
      <div className={styles.clearance} aria-hidden />
      <button
        type="button"
        className={`button ${styles.toggle}`}
        aria-expanded={open}
        aria-controls="story-chat"
        onClick={toggle}
      >
        Chat
        {unread > 0 && (
          <span className={styles.badge}>
            {unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </button>

      <aside id="story-chat" className={styles.panel} hidden={!open} aria-label="Story Chat">
        <header className={styles.head}>
          <h2 className={styles.heading}>Story Chat</h2>
          <button type="button" className="button button-small" onClick={() => setOpen(false)}>
            Close
          </button>
        </header>

        <ol
          ref={listRef}
          className={styles.messages}
          aria-live="polite"
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {hasEarlier && (
            <li className={styles.earlier}>
              <button type="button" className="link-button muted" onClick={loadEarlier}>
                Load earlier messages
              </button>
            </li>
          )}
          {!messages.length && !error && <li className="muted">No messages yet. Say hi to your co-writers.</li>}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped =
              prev?.user_id === m.user_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < GROUP_MS;
            const person = people.get(m.user_id);
            return (
              <li key={m.id} className={grouped ? styles.grouped : styles.message}>
                {!grouped && (
                  <div className={styles.byline}>
                    <span
                      className={styles.author}
                      style={{ "--author": person?.author_color ?? "var(--rule)" } as React.CSSProperties}
                    >
                      {person?.username ?? "…"}
                    </span>
                    <time className="muted" dateTime={m.created_at}>
                      {formatTime(m.created_at)}
                    </time>
                  </div>
                )}
                <p className={styles.body}>{m.body}</p>
              </li>
            );
          })}
        </ol>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <form
          className={styles.compose}
          onSubmit={(e) => {
            e.preventDefault();
            void send(e.currentTarget);
          }}
        >
          <textarea
            name="body"
            className={`input ${styles.input}`}
            placeholder="Message your co-writers"
            aria-label="Message"
            maxLength={2000}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="button button-primary button-small">Send</button>
        </form>
      </aside>
    </>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
