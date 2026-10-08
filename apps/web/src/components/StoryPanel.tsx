"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createSlot } from "./Slot";
import styles from "./StoryPanel.module.css";

export type PanelName = "chat" | "history" | "notes";

/** The open Chapter's Snapshot history, as its footer shows it. Set while a Co-host+ has a Chapter open. */
export type HistoryInfo = { latestAt: string | null };

type StoryPanel = {
  open: PanelName | null;
  toggle: (name: PanelName) => void;
  close: (name?: PanelName) => void;
  unread: number;
  addUnread: () => void;
  history: HistoryInfo | null;
  setHistory: (info: HistoryInfo | null) => void;
};

const PanelContext = createContext<StoryPanel | null>(null);
const Slot = createSlot();

/**
 * The right-hand panel inside a Story: Chat, History or a Chapter's Notes, one at a time. It lives in the Story layout so
 * Chat's unread count and subscription survive moving between pages; the Desk places a PanelSlot
 * where the panel should appear.
 */
export function StoryPanelProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = useState<PanelName | null>(null);
  const [unread, setUnread] = useState(0);
  const [history, setHistory] = useState<HistoryInfo | null>(null);

  const toggle = useCallback((name: PanelName) => {
    if (name === "chat") setUnread(0);
    setPanel((current) => (current === name ? null : name));
  }, []);
  const close = useCallback(
    (name?: PanelName) => setPanel((current) => (!name || current === name ? null : current)),
    []
  );
  const addUnread = useCallback(() => setUnread((n) => n + 1), []);
  const value = useMemo<StoryPanel>(
    () => ({ open: panel, toggle, close, unread, addUnread, history, setHistory }),
    [panel, toggle, close, unread, addUnread, history]
  );

  return (
    <PanelContext value={value}>
      <Slot.Provider>{children}</Slot.Provider>
    </PanelContext>
  );
}

export function useStoryPanel() {
  return useContext(PanelContext);
}

/** Whether `name` is open and on screen; with no PanelSlot (the Reader), nothing is. */
export function usePanelOpen(name: PanelName) {
  const panel = useStoryPanel();
  const target = Slot.useTarget();
  return panel?.open === name && target !== null;
}

/** Where the panel shows: over the desk's main column. */
export function PanelSlot() {
  return <Slot.Target className={styles.slot} />;
}

export function Panel({
  name,
  title,
  children,
}: {
  name: PanelName;
  title: string;
  children: React.ReactNode;
}) {
  const close = useStoryPanel()?.close;
  const open = usePanelOpen(name);
  const ref = useRef<HTMLElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!open || !close) return;
    ref.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(name);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close, name]);

  return (
    <Slot.Fill>
      <aside ref={ref} className={styles.panel} hidden={!open} aria-labelledby={headingId} tabIndex={-1}>
        <header className={styles.head}>
          <h2 id={headingId} className={styles.heading}>
            {title}
          </h2>
          <button type="button" className={styles.close} onClick={() => close?.(name)} aria-label={`Close ${title}`}>
            <svg viewBox="0 0 20 20" className={styles.closeIcon} aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>
        {children}
      </aside>
    </Slot.Fill>
  );
}

/** Opens Story Chat, with the count of messages that arrived while it was closed. */
export function ChatButton({ className }: { className?: string }) {
  const panel = useStoryPanel();
  const open = usePanelOpen("chat");
  if (!panel) return null;

  return (
    <button type="button" className={className} aria-expanded={open} onClick={() => panel.toggle("chat")}>
      Chat
      {panel.unread > 0 && (
        <span className="badge">
          {panel.unread}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </button>
  );
}
