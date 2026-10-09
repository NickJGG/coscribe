"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authorColorCss } from "@/lib/profile-rules";
import { toStoredBody } from "@/lib/writer-mentions";
import { useQuietToasts } from "./Notifications";
import { Panel, usePanelOpen, useStoryPanel } from "./StoryPanel";
import { usePeople, useStoryMembers } from "./StoryMembers";
import { WriterMentionPicker, useWriterMentionPicker } from "./WriterMentionPicker";
import { WriterMentionText } from "./WriterMentionText";
import styles from "./StoryChat.module.css";

type Message = { id: string; user_id: string; body: string; created_at: string };

const PAGE = 50;
const COLUMNS = "id, user_id, body, created_at";
/** Consecutive messages from one Writer within this window share a single name line. */
const GROUP_MS = 5 * 60 * 1000;
/** How many earlier pages a `?chat=` link loads looking for its message before giving up. */
const REVEAL_PAGES = 5;
const FLASH_MS = 1600;

function merge(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Story Chat in the Story's right panel, rendered only for Writers and up. It stays mounted in the Story
 * layout, so it keeps listening (and counting unread) while closed. RLS keeps both history and Realtime
 * delivery to members, so a Writer removed mid-session simply stops receiving messages. A `?chat=<id>` link
 * (from a chat_mention) opens it scrolled to that message.
 */
export function StoryChat({ storyId, me }: { storyId: string; me: string }) {
  const supabase = useMemo(() => createClient(), []);
  const panel = useStoryPanel();
  const addUnread = panel?.addUnread;
  const showPanel = panel?.show;
  const open = usePanelOpen("chat");
  const quiet = useQuietToasts();
  const { members } = useStoryMembers();
  const linked = useSearchParams().get("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const picker = useWriterMentionPicker(draft, setDraft);
  const openRef = useRef(open);
  const listRef = useRef<HTMLOListElement>(null);
  const stickToBottom = useRef(true);
  const loadingEarlier = useRef(false);
  const reveal = useRef<{ id: string; pages: number; done: boolean } | null>(null);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !quiet) return;
    quiet.setChatOpenFor(storyId);
    return () => quiet.setChatOpenFor(null);
  }, [open, storyId, quiet]);

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
    setLoaded(true);
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
          if (!openRef.current && message.user_id !== me) addUnread?.();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void loadLatest();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, storyId, me, loadLatest, addUnread]);

  const authorIds = useMemo(() => [...new Set(messages.map((m) => m.user_id))], [messages]);
  const person = usePeople(authorIds);

  // Opening the panel starts from the newest message.
  useEffect(() => {
    if (open) stickToBottom.current = true;
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (open && list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [open, messages]);

  const oldestAt = messages[0]?.created_at;
  const loadEarlier = useCallback(async () => {
    if (!oldestAt || loadingEarlier.current) return;
    loadingEarlier.current = true;
    const list = listRef.current;
    const fromBottom = list ? list.scrollHeight - list.scrollTop : 0;

    const { data, error } = await supabase
      .from("chat_messages")
      .select(COLUMNS)
      .eq("story_id", storyId)
      .lt("created_at", oldestAt)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    loadingEarlier.current = false;
    if (error) return setError("Couldn't load earlier messages.");
    stickToBottom.current = false;
    setMessages((current) => merge(current, data));
    setHasEarlier(data.length === PAGE);
    requestAnimationFrame(() => {
      if (list) list.scrollTop = list.scrollHeight - fromBottom;
    });
  }, [supabase, storyId, oldestAt]);

  useEffect(() => {
    if (!linked) return;
    reveal.current = { id: linked, pages: 0, done: false };
    showPanel?.("chat");
  }, [linked, showPanel]);

  // Pages back until the linked message is loaded, then scrolls to it once the panel is showing.
  useEffect(() => {
    const target = reveal.current;
    if (!target || target.done || !loaded || !open) return;
    if (!messages.some((m) => m.id === target.id)) {
      if (hasEarlier && target.pages < REVEAL_PAGES) {
        target.pages++;
        void loadEarlier();
      } else target.done = true;
      return;
    }
    target.done = true;
    stickToBottom.current = false;
    // Queued after loadEarlier's own scroll fix-up, so this one wins.
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(`[data-chat-message="${target.id}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.setAttribute("data-flash", "");
      setTimeout(() => el.removeAttribute("data-flash"), FLASH_MS);
    });
  }, [linked, loaded, open, messages, hasEarlier, loadEarlier]);

  async function send() {
    const body = toStoredBody(draft.trim(), members);
    if (!body) return;

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ story_id: storyId, body })
      .select(COLUMNS)
      .single();
    if (error) return setError("Couldn't send. You may no longer be in this story.");
    setError(null);
    setDraft("");
    stickToBottom.current = true;
    setMessages((current) => merge(current, [data]));
  }

  return (
    <Panel name="chat" title="Story Chat">
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
          const author = person(m.user_id);
          return (
            <li key={m.id} className={grouped ? styles.grouped : styles.message} data-chat-message={m.id}>
              {!grouped && (
                <div className={styles.byline}>
                  <span
                    className={styles.author}
                    style={{ "--author": author ? authorColorCss(author.color) : "var(--rule)" } as React.CSSProperties}
                  >
                    {author?.name ?? "…"}
                  </span>
                  <time className="muted" dateTime={m.created_at}>
                    {formatTime(m.created_at)}
                  </time>
                </div>
              )}
              <p className={styles.body}>
                <WriterMentionText body={m.body} />
              </p>
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
          void send();
        }}
      >
        <WriterMentionPicker picker={picker}>
          <textarea
            {...picker.textareaProps}
            name="body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={`input ${styles.input}`}
            placeholder="Message your co-writers"
            aria-label="Message"
            maxLength={2000}
            rows={2}
            onKeyDown={(e) => {
              if (picker.onKeyDown(e)) return;
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </WriterMentionPicker>
        <button className="button button-primary button-small">Send</button>
      </form>
    </Panel>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
