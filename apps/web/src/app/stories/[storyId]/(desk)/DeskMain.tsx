"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { relativeTime } from "@/lib/relative-time";
import { DeskScrollContext } from "@/components/DeskScroll";
import { DeskToolbar } from "@/components/DeskToolbar";
import { FIND_CURRENT } from "@/components/Find";
import { useLiveStatus } from "@/components/LiveStatus";
import { useHereNow } from "@/components/StoryPresence";
import { PanelSlot, usePanelOpen, useStoryPanel } from "@/components/StoryPanel";
import styles from "./desk.module.css";

const SCROLL_KEY = "coscribe:desk-scroll:";

function readScroll(doc: string) {
  try {
    return Number(sessionStorage.getItem(SCROLL_KEY + doc)) || 0;
  } catch {
    return 0;
  }
}

function writeScroll(doc: string, top: number) {
  try {
    sessionStorage.setItem(SCROLL_KEY + doc, String(Math.round(top)));
  } catch {}
}

const MENTION_HASH = /^#mention-([0-9a-f-]{36})$/i;
const LOOK_TRIES = 10;
const FLASH_MS = 1600;

/**
 * Scrolls to the first element matching `selector` and briefly highlights it (or, with `all`, every match:
 * the pieces of one search match), as a "Mentioned in" or Story search link asks. Decorations can land a
 * frame or two after the text, so it looks again for a few frames before giving up. The returned stop
 * function says whether it was still looking.
 */
function show(page: HTMLElement, selector: string, all: boolean, otherwise: () => void) {
  let tries = 0;
  let frame = 0;
  const look = () => {
    frame = 0;
    const found = [...page.querySelectorAll<HTMLElement>(selector)].slice(0, all ? undefined : 1);
    if (!found.length) {
      if (++tries < LOOK_TRIES) frame = requestAnimationFrame(look);
      else otherwise();
      return;
    }
    found[0]!.scrollIntoView({ block: "center" });
    for (const el of found) el.setAttribute("data-flash", "");
    setTimeout(() => found.forEach((el) => el.removeAttribute("data-flash")), FLASH_MS);
  };
  look();
  return () => {
    cancelAnimationFrame(frame);
    return frame !== 0;
  };
}

/**
 * The column beside the sidebar: the open document's toolbar row, the scrolling page, the footer, and
 * the right panel over all three. Each document reopens where this browser tab last left it,
 * once its text has synced; until then nothing is saved, so the empty page can't overwrite the position.
 * A `#mention-<entryId>` link opens at that Entry's first Mention instead, a `?find=…&n=` link at that
 * search match (again on every step), and a `?note=` link leaves it to the Note.
 */
export function DeskMain({ footer, children }: { footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const { doc, ready } = useLiveStatus();
  const params = useSearchParams();
  const finding = params.has("find") && params.has("n") ? `${params.get("n")} ${params.get("find")}` : null;
  const scroller = useRef<HTMLDivElement>(null);
  const restored = useRef<string | null>(null);

  useLayoutEffect(() => {
    restored.current = null;
    scroller.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const page = scroller.current;
    if (!doc || !ready || restored.current === doc || !page) return;
    restored.current = doc;
    // The Notes on the page scroll to a linked Note themselves.
    const search = new URLSearchParams(location.search);
    if (search.has("note") || (search.has("find") && search.has("n"))) return;
    const entryId = MENTION_HASH.exec(location.hash)?.[1];
    if (!entryId) return page.scrollTo(0, readScroll(doc));
    const stop = show(page, `[data-mention="${entryId}"]`, false, () => page.scrollTo(0, readScroll(doc)));
    return () => {
      if (stop()) restored.current = null;
    };
  }, [doc, ready]);

  useEffect(() => {
    const page = scroller.current;
    if (!doc || !ready || !finding || !page) return;
    const stop = show(page, `[${FIND_CURRENT}]`, true, () => page.scrollTo(0, readScroll(doc)));
    return () => void stop();
  }, [doc, ready, finding]);

  return (
    <DeskToolbar.Provider>
      <div className={styles.main}>
        <DeskToolbar.Target className={styles.toolbarSlot} />
        <div
          ref={scroller}
          className={styles.scroll}
          onScroll={(e) => {
            if (restored.current) writeScroll(restored.current, e.currentTarget.scrollTop);
          }}
        >
          <DeskScrollContext value={scroller}>{children}</DeskScrollContext>
        </div>
        {footer}
        <PanelSlot />
      </div>
    </DeskToolbar.Provider>
  );
}

/**
 * Word count for everyone: the open document's once it's synced, else the Story's. Members also see how
 * many Writers are here; Co-hosts and up, on a Chapter, when it was last Snapshotted and the way into
 * History. Signed-out Viewers get one quiet way in.
 */
export function DeskFooter({
  member,
  signedOut,
  storyWords,
}: {
  member: boolean;
  signedOut: boolean;
  storyWords: number;
}) {
  const live = useLiveStatus();
  const hereNow = useHereNow();
  const shown = live.doc ? (live.ready ? live.words : null) : storyWords;
  const here = live.doc ? live.writers.length : hereNow.length;
  const panel = useStoryPanel();
  const historyOpen = usePanelOpen("history");
  const history = panel?.history;

  return (
    <footer className={styles.footer}>
      <span className={styles.tnum}>
        {shown !== null && `${shown.toLocaleString("en-US")} ${shown === 1 ? "word" : "words"}`}
        {shown !== null && member && here > 0 && ` · ${here} here`}
      </span>
      {history && (
        <span className={styles.footerEnd}>
          <span>
            {history.latestAt
              ? `Snapshot saved ${relativeTime(Date.parse(history.latestAt))}`
              : "No Snapshots yet"}
          </span>
          <span aria-hidden>&middot;</span>
          <button
            type="button"
            className={styles.footerButton}
            aria-expanded={historyOpen}
            onClick={() => panel?.toggle("history")}
          >
            History
          </button>
        </span>
      )}
      {signedOut && (
        <Link href="/login" className={styles.footerLink}>
          Write one with your friends &rarr;
        </Link>
      )}
    </footer>
  );
}
