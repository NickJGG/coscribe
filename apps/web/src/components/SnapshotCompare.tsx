"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { hasOpenLayer } from "@/lib/layers";
import { createClient } from "@/lib/supabase/client";
import { useDeskScroll } from "./DeskScroll";
import { isTyping } from "./FindBar";
import { usePanelOpen, useStoryPanel } from "./StoryPanel";

export type Snapshot = { id: string; taken_at: string; name: string | null };

type SnapshotCompareValue = {
  /** The live Chapter's editor, whose text is the comparison's "Current text". */
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  snapshots: Snapshot[] | null;
  listError: string | null;
  loadList: () => Promise<void>;
  /** The Snapshot being compared, from `?compare=`. Null when the live Chapter shows. */
  compare: string | null;
  /** The Snapshot it's compared with, from `&to=`. Null means the current text. */
  to: string | null;
  openCompare: (id: string) => void;
  setTo: (id: string | null) => void;
  exit: () => void;
};

const CompareContext = createContext<SnapshotCompareValue | null>(null);

/** The open Chapter's Snapshot comparison, or null where there is none (below Co-host, Entries). */
export function useSnapshotCompare() {
  return useContext(CompareContext);
}

const LIMIT = 100;
const DESKTOP = "(min-width: 601px)";

const desktop = () => window.matchMedia(DESKTOP).matches;

function onWidthChange(change: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/** Whether the desk is phone-sized (600px or narrower), where the History panel covers the screen. */
export function usePhone() {
  return useSyncExternalStore(onWidthChange, () => !desktop(), () => false);
}

/**
 * A Chapter's Snapshot list and the comparison open over it, for Co-hosts and up. The comparison lives
 * in the URL (`?compare=<id>&to=<id>`); while one is open the live Chapter stays connected but hidden,
 * and the desk returns to its scroll position on exit. Esc, or closing the History panel on desktop,
 * leaves it.
 */
export function SnapshotCompareProvider({ chapterId, children }: { chapterId: string; children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const panel = useStoryPanel();
  const setHistory = panel?.setHistory;
  const open = usePanelOpen("history");
  const scroller = useDeskScroll();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const compare = params.get("compare");
  const to = compare && params.get("to") !== compare ? params.get("to") : null;
  const comparing = compare !== null;

  const fetchList = useCallback(
    () =>
      supabase
        .from("chapter_snapshots")
        .select("id, taken_at, name")
        .eq("chapter_id", chapterId)
        .order("taken_at", { ascending: false })
        .limit(LIMIT),
    [supabase, chapterId]
  );

  const showList = useCallback(
    ({ data, error }: Awaited<ReturnType<typeof fetchList>>) => {
      setListError(error ? "Couldn't load the history." : null);
      if (!data) return;
      setSnapshots(data);
      setHistory?.({ latestAt: data[0]?.taken_at ?? null });
    },
    [setHistory]
  );

  const loadList = useCallback(async () => showList(await fetchList()), [fetchList, showList]);

  useEffect(() => {
    if (open || comparing) void fetchList().then(showList);
  }, [open, comparing, fetchList, showList]);

  const go = useCallback(
    (compare: string | null, to: string | null) => {
      const query = compare ? `?compare=${compare}${to ? `&to=${to}` : ""}` : "";
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [router, pathname]
  );
  const openCompare = useCallback((id: string) => go(id, id === to ? null : to), [go, to]);
  const setTo = useCallback((id: string | null) => go(compare, id), [go, compare]);
  const exit = useCallback(() => go(null, null), [go]);

  const showPanelOnLoad = useEffectEvent(() => {
    if (comparing && desktop()) panel?.show("history");
  });
  useEffect(() => showPanelOnLoad(), []);

  const wasOpen = useRef(open);
  const onPanel = useEffectEvent((open: boolean) => {
    if (wasOpen.current && !open && comparing && desktop()) exit();
    wasOpen.current = open;
  });
  useEffect(() => onPanel(open), [open]);

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (comparing && e.key === "Escape" && !e.defaultPrevented && !hasOpenLayer() && !isTyping(e.target)) exit();
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const wasComparing = useRef(comparing);
  const liveScroll = useRef(0);
  useLayoutEffect(() => {
    const page = scroller?.current;
    if (!page || wasComparing.current === comparing) return;
    wasComparing.current = comparing;
    if (comparing) {
      liveScroll.current = page.scrollTop;
      page.scrollTo(0, 0);
    } else {
      page.scrollTo(0, liveScroll.current);
    }
  }, [scroller, comparing]);

  const value = useMemo<SnapshotCompareValue>(
    () => ({ editor, setEditor, snapshots, listError, loadList, compare, to, openCompare, setTo, exit }),
    [editor, snapshots, listError, loadList, compare, to, openCompare, setTo, exit]
  );

  return <CompareContext value={value}>{children}</CompareContext>;
}
