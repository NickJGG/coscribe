"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLiveStatus } from "@/components/LiveStatus";
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

/**
 * The scrolling column beside the sidebar. Each document reopens where this browser tab last left it,
 * once its text has synced; until then nothing is saved, so the empty page can't overwrite the position.
 */
export function DeskMain({ footer, children }: { footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const { doc, ready } = useLiveStatus();
  const scroller = useRef<HTMLDivElement>(null);
  const restored = useRef<string | null>(null);

  useLayoutEffect(() => {
    restored.current = null;
    scroller.current?.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!doc || !ready || restored.current === doc) return;
    restored.current = doc;
    scroller.current?.scrollTo(0, readScroll(doc));
  }, [doc, ready]);

  return (
    <div className={styles.main}>
      <div
        ref={scroller}
        className={styles.scroll}
        onScroll={(e) => {
          if (restored.current) writeScroll(restored.current, e.currentTarget.scrollTop);
        }}
      >
        {children}
      </div>
      {footer}
    </div>
  );
}

/** Word count for everyone; signed-out Viewers also get one quiet way in. */
export function DeskFooter({ signedOut }: { signedOut: boolean }) {
  const { ready, words } = useLiveStatus();

  return (
    <footer className={styles.footer}>
      <span className={styles.tnum}>
        {ready && `${words.toLocaleString("en-US")} ${words === 1 ? "word" : "words"}`}
      </span>
      {signedOut && (
        <Link href="/login" className={styles.footerLink}>
          Write one with your friends &rarr;
        </Link>
      )}
    </footer>
  );
}
