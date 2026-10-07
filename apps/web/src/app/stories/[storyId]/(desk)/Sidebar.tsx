"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ENTRY_GROUP_LABEL, ENTRY_TYPES, filterEntries, type EntryType } from "@/lib/entries";
import { shortWords } from "@/lib/words";
import { useDeskFrame, type SidebarTab } from "./DeskFrame";
import styles from "./desk.module.css";

type Chapter = { id: string; title: string; locked: boolean; word_count: number };
type Entry = { id: string; type: EntryType; name: string };

const TABS: { tab: SidebarTab; label: string }[] = [
  { tab: "chapters", label: "Chapters" },
  { tab: "bible", label: "Bible" },
];

/**
 * Navigation through a Story: Chapters and Story Bible tabs, each keeping its own scroll position.
 * Managing Chapters stays on the overview; `newChapter` and `newEntry` are the only writing tools here.
 */
export function Sidebar({
  storyId,
  storyTitle,
  chapters,
  entries,
  newChapter,
  newEntry,
}: {
  storyId: string;
  storyTitle: string;
  chapters: Chapter[];
  entries: Entry[];
  newChapter: React.ReactNode;
  newEntry: React.ReactNode;
}) {
  const { collapsed, overlay, tab, setTab, open, toggle, close, searchRef } = useDeskFrame();
  const { chapterId, entryId } = useParams<{ chapterId?: string; entryId?: string }>();
  const [query, setQuery] = useState("");
  const panes = useRef<Record<SidebarTab, HTMLDivElement | null>>({ chapters: null, bible: null });
  const scrollTops = useRef<Record<SidebarTab, number>>({ chapters: 0, bible: 0 });
  const tabRefs = useRef<Record<SidebarTab, HTMLButtonElement | null>>({ chapters: null, bible: null });

  // A pane that was hidden comes back where it was left.
  useLayoutEffect(() => {
    const pane = panes.current[tab];
    if (pane) pane.scrollTop = scrollTops.current[tab];
  }, [tab, collapsed, overlay]);

  useLayoutEffect(() => {
    const pane = panes.current.chapters;
    const row = pane?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!pane || !row) return;
    if (row.offsetTop < pane.scrollTop || row.offsetTop + row.offsetHeight > pane.scrollTop + pane.clientHeight) {
      pane.scrollTop = row.offsetTop - pane.clientHeight / 2;
    }
  }, [chapterId]);

  const found = filterEntries(entries, query, null);
  const onTabKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const next = tab === "chapters" ? "bible" : "chapters";
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <>
      <aside className={styles.sidebar} aria-label="Story">
        <div className={styles.strip}>
          <button type="button" className={styles.stripButton} onClick={toggle} title="Show the sidebar (Ctrl+\)">
            <PanelIcon />
            <span className="sr-only">Show the sidebar</span>
          </button>
          <button type="button" className={styles.stripButton} onClick={() => open("chapters")} title="Chapters">
            <ChaptersIcon />
            <span className="sr-only">Chapters</span>
          </button>
          <button type="button" className={styles.stripButton} onClick={() => open("bible")} title="Story Bible">
            <BibleIcon />
            <span className="sr-only">Story Bible</span>
          </button>
        </div>

        <div className={styles.full}>
          <span className={styles.grab} aria-hidden />
          <div className={styles.top}>
            <div className={styles.titleRow}>
              <Link href={`/stories/${storyId}`} className={styles.storyTitle}>
                {storyTitle}
              </Link>
              <button type="button" className={styles.stripButton} onClick={toggle} title="Hide the sidebar (Ctrl+\)">
                <PanelIcon />
                <span className="sr-only">Hide the sidebar</span>
              </button>
            </div>
            <div role="tablist" aria-label="Sidebar" className={styles.tabs}>
              {TABS.map(({ tab: t, label }) => (
                <button
                  key={t}
                  ref={(el) => {
                    tabRefs.current[t] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`sidebar-tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`sidebar-pane-${t}`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  onKeyDown={onTabKey}
                >
                  {label} <span className={styles.count}>{t === "chapters" ? chapters.length : entries.length}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            ref={(el) => {
              panes.current.chapters = el;
            }}
            role="tabpanel"
            id="sidebar-pane-chapters"
            aria-labelledby="sidebar-tab-chapters"
            className={styles.pane}
            hidden={tab !== "chapters"}
            onScroll={(e) => (scrollTops.current.chapters = e.currentTarget.scrollTop)}
          >
            <ol className={styles.list}>
              {chapters.map((chapter, i) => (
                <li key={chapter.id}>
                  <Link
                    href={`/stories/${storyId}/chapters/${chapter.id}`}
                    scroll={false}
                    className={styles.row}
                    aria-current={chapter.id === chapterId ? "page" : undefined}
                  >
                    <span className={styles.num}>{i + 1}</span>
                    <span className={styles.name}>{chapter.title}</span>
                    <span className={styles.meta}>
                      {chapter.locked && (
                        <>
                          <LockIcon />
                          <span className="sr-only">Locked,</span>
                        </>
                      )}
                      {shortWords(chapter.word_count)}
                      <span className="sr-only"> words</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {newChapter}
          </div>

          <div
            ref={(el) => {
              panes.current.bible = el;
            }}
            role="tabpanel"
            id="sidebar-pane-bible"
            aria-labelledby="sidebar-tab-bible"
            className={styles.pane}
            hidden={tab !== "bible"}
            onScroll={(e) => (scrollTops.current.bible = e.currentTarget.scrollTop)}
          >
            {entries.length > 0 && (
              <label className={styles.search}>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the Bible"
                  aria-label="Search the Bible"
                  autoComplete="off"
                />
                <kbd aria-hidden>/</kbd>
              </label>
            )}
            {ENTRY_TYPES.map((type) => {
              const group = found.filter((e) => e.type === type);
              if (!group.length) return null;
              return (
                <div key={type} className={styles.group}>
                  <h3 className="smallcaps">{ENTRY_GROUP_LABEL[type]}</h3>
                  <ul className={styles.list}>
                    {group.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={`/stories/${storyId}/bible/${entry.id}`}
                          scroll={false}
                          className={`${styles.row} ${styles.entryRow}`}
                          aria-current={entry.id === entryId ? "page" : undefined}
                        >
                          <span className={styles.name}>{entry.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {entries.length === 0 ? (
              <p className={`muted ${styles.empty}`}>No Entries yet.</p>
            ) : (
              !found.length && <p className={`muted ${styles.empty}`}>No Entries match.</p>
            )}
            {newEntry}
          </div>
        </div>
      </aside>
      {overlay && <div className={styles.scrim} onClick={close} aria-hidden />}
    </>
  );
}

function PanelIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M8 4v12" />
    </svg>
  );
}

function ChaptersIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <path d="M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01" />
    </svg>
  );
}

function BibleIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5v-12ZM4 16.5A1.5 1.5 0 0 0 5.5 18H16v-3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className={styles.lock} viewBox="0 0 20 20" aria-hidden>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  );
}
