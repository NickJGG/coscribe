"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEditorState, type Editor } from "@tiptap/react";
import type { DocumentKind } from "@coscribe/editor";
import type { DocumentCount } from "@/lib/search";
import { findKey } from "./Find";
import { useStorySearch } from "./StorySearch";
import liveStyles from "./LiveDocument.module.css";
import styles from "./Find.module.css";

const MOVED_MS = 2500;

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function sum(docs: DocumentCount[]) {
  return docs.reduce((total, d) => total + d.count, 0);
}

/**
 * "q | X of N ‹ › ☰ ✕" over a document opened from Story search. X of N counts across the Story, with
 * this document's own count live. Stepping past either end carries on into the nearest document with
 * matches, wrapping around the Story. Every step replaces history, so Back returns to the results.
 * Enter / Shift+Enter step from inside the bar, Ctrl+G / Shift+Ctrl+G from anywhere, and Escape outside
 * the text closes it.
 */
export function FindBar({
  kind,
  id,
  query,
  current,
  editor,
}: {
  kind: DocumentKind;
  id: string;
  query: string;
  current: number | null;
  editor: Editor | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { storyId } = useParams<{ storyId: string }>();
  const { load, counts } = useStorySearch();
  const story = useMemo(() => counts(query), [counts, query]);
  const live = useEditorState({
    editor,
    selector: ({ editor }) => (editor && findKey.getState(editor.state)?.count) ?? null,
  });
  const [movedSeen, setMovedSeen] = useState<string | null>(null);

  useEffect(load, [load]);

  const at = story.findIndex((d) => d.kind === kind && d.id === id);
  const here = at < 0 ? null : story[at]!;
  const local = live ?? here?.count ?? 0;
  const before = here ? sum(story.slice(0, at)) : 0;
  const total = here ? sum(story) - here.count + local : local;
  const shown = current && local ? Math.min(current, local) : null;
  const moved =
    live !== null && current !== null && live > 0 && current > live ? `${pathname}:${current}:${live}` : null;

  useEffect(() => {
    if (!moved) return;
    const timer = setTimeout(() => setMovedSeen(moved), MOVED_MS);
    return () => clearTimeout(timer);
  }, [moved]);

  const go = (path: string, n?: number) =>
    router.replace(`${path}?find=${encodeURIComponent(query)}${n ? `&n=${n}` : ""}`, { scroll: false });

  /** The nearest other document with matches in that direction, wrapping around the Story. */
  const neighbor = (dir: 1 | -1) => {
    if (at < 0) return null;
    for (let k = 1; k < story.length; k++) {
      const d = story[(at + dir * k + story.length) % story.length]!;
      if (d.count > 0) return d;
    }
    return null;
  };

  const within = (dir: 1 | -1) => {
    const next = shown === null ? (dir > 0 ? 1 : local) : shown + dir;
    return next >= 1 && next <= local ? next : null;
  };

  const step = (dir: 1 | -1) => {
    const next = within(dir);
    if (next) return go(pathname, next);
    const d = neighbor(dir);
    const path = d && `/stories/${storyId}/${d.kind === "chapter" ? "chapters" : "bible"}/${d.id}`;
    if (d && path) go(path, dir > 0 ? 1 : d.count);
    else if (local) go(pathname, dir > 0 ? 1 : local);
  };

  const close = () => router.replace(pathname, { scroll: false });

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "g" && (e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape" && !e.defaultPrevented && !isTyping(e.target)) {
      close();
    }
  });

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const title = (dir: 1 | -1) => {
    const word = dir > 0 ? "Next" : "Previous";
    const keys = dir > 0 ? "Ctrl+G" : "Shift+Ctrl+G";
    const d = within(dir) ? null : neighbor(dir);
    return `${d ? `${word}: ${d.label}` : `${word} match`} (${keys})`;
  };
  const canStep = local > 0 || neighbor(1) !== null;

  let position: string;
  if (moved && movedSeen !== moved) position = "Match moved";
  else if (current !== null && live === 0) position = "No longer found here";
  else if (shown !== null) position = `${Math.min(before + shown, total)} of ${total}`;
  else position = total === 1 ? "1 match" : `${total.toLocaleString("en-US")} matches`;

  return (
    <div
      className={styles.bar}
      role="search"
      aria-label="Find in Story"
      onKeyDown={(e) => {
        if (e.key !== "Enter" || (e.target as Element).closest("a, [data-find-close]")) return;
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
      }}
    >
      <span className={styles.query} title={query}>
        {query}
      </span>
      <span className={styles.position} role="status">
        {position}
      </span>
      <button
        type="button"
        className={liveStyles.tool}
        disabled={!canStep}
        onClick={() => step(-1)}
        title={title(-1)}
        aria-label={title(-1)}
      >
        &lsaquo;
      </button>
      <button
        type="button"
        className={liveStyles.tool}
        disabled={!canStep}
        onClick={() => step(1)}
        title={title(1)}
        aria-label={title(1)}
      >
        &rsaquo;
      </button>
      <Link
        href={`/stories/${storyId}/search?q=${encodeURIComponent(query)}`}
        className={liveStyles.tool}
        title="All results"
        aria-label="All results"
      >
        <ListIcon />
      </Link>
      <button
        type="button"
        className={liveStyles.tool}
        data-find-close
        onClick={close}
        title="Close (Escape)"
        aria-label="Close find"
      >
        ✕
      </button>
    </div>
  );
}

function ListIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <path d="M4 6h12M4 10h12M4 14h12" />
    </svg>
  );
}
