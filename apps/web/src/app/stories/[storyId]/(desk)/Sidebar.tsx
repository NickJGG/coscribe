"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EntryType } from "@/lib/entries";
import { joinNames } from "@/lib/presence";
import { Avatar } from "@/components/Avatar";
import { useHereNow, type HereNow } from "@/components/StoryPresence";
import { BibleList } from "./BibleList";
import { ChapterList } from "./ChapterList";
import { useDeskFrame, type SidebarTab } from "./DeskFrame";
import { SidebarResize } from "./SidebarResize";
import styles from "./desk.module.css";

type Chapter = { id: string; title: string; locked: boolean; word_count: number };
type Entry = { id: string; type: EntryType; name: string };

const TABS: { tab: SidebarTab; label: string }[] = [
  { tab: "chapters", label: "Chapters" },
  { tab: "bible", label: "Bible" },
];

/**
 * Navigation through a Story: the Overview, (for members) Settings and Story search, then Chapters and
 * Story Bible tabs, each keeping its own scroll position. Management lives here too: `newChapter` and
 * `newEntry`, and the "···" menus from `chapterMenus`, `entryMenus` (keyed by id) and `typeMenus` (keyed by
 * Entry Type), rendered by the layout. When `reorderable`, Chapters, Entries and Entry Types can also be
 * dragged into a new order.
 */
export function Sidebar({
  storyId,
  storyTitle,
  chapters,
  entries,
  typeOrder,
  member,
  reorderable,
  chapterMenus,
  entryMenus,
  typeMenus,
  newChapter,
  newEntry,
}: {
  storyId: string;
  storyTitle: string;
  chapters: Chapter[];
  entries: Entry[];
  typeOrder: EntryType[];
  member: boolean;
  reorderable: boolean;
  chapterMenus?: Record<string, React.ReactNode>;
  entryMenus?: Record<string, React.ReactNode>;
  typeMenus?: Partial<Record<EntryType, React.ReactNode>>;
  newChapter: React.ReactNode;
  newEntry: React.ReactNode;
}) {
  const { collapsed, overlay, tab, setTab, open, toggle, close, focusSearch } = useDeskFrame();
  const { chapterId, entryId } = useParams<{ chapterId?: string; entryId?: string }>();
  const panes = useRef<Record<SidebarTab, HTMLDivElement | null>>({ chapters: null, bible: null });
  const scrollTops = useRef<Record<SidebarTab, number>>({ chapters: 0, bible: 0 });
  const tabRefs = useRef<Record<SidebarTab, HTMLButtonElement | null>>({ chapters: null, bible: null });
  const full = useRef<HTMLDivElement>(null);
  const here = useHereNow();
  const pathname = usePathname();
  const overviewHref = `/stories/${storyId}`;
  const settingsHref = `/stories/${storyId}/settings`;
  const currentIf = (href: string) => (pathname === href ? "page" : undefined);
  const settingsCurrent = pathname.startsWith(settingsHref) ? "page" : undefined;

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
          <button
            type="button"
            className={styles.stripButton}
            onClick={toggle}
            data-tip="Show the sidebar"
            data-keys="Ctrl+\"
            data-side="right"
          >
            <PanelIcon />
            <span className="sr-only">Show the sidebar</span>
          </button>
          <Link
            href={overviewHref}
            className={styles.stripButton}
            aria-current={currentIf(overviewHref)}
            data-tip="Overview"
            data-side="right"
          >
            <HomeIcon />
            <span className="sr-only">Overview</span>
          </Link>
          <button
            type="button"
            className={styles.stripButton}
            onClick={() => open("chapters")}
            data-tip="Chapters"
            data-side="right"
          >
            <ChaptersIcon />
            <span className="sr-only">Chapters</span>
          </button>
          <button
            type="button"
            className={styles.stripButton}
            onClick={() => open("bible")}
            data-tip="Story Bible"
            data-side="right"
          >
            <BibleIcon />
            <span className="sr-only">Story Bible</span>
          </button>
          <button
            type="button"
            className={styles.stripButton}
            onClick={focusSearch}
            data-tip="Search"
            data-keys="/"
            data-side="right"
          >
            <SearchIcon />
            <span className="sr-only">Search</span>
          </button>
          {here.length > 0 && (
            <span
              className={styles.stripHere}
              data-tip={`Here now: ${joinNames(here.map((h) => h.person.name))}`}
              data-side="right"
            >
              <span className="sr-only">{here.length} here now</span>
            </span>
          )}
          {member && (
            <Link
              href={settingsHref}
              className={`${styles.stripButton} ${styles.stripEnd}`}
              aria-current={settingsCurrent}
              data-tip="Settings"
              data-side="right"
            >
              <SettingsIcon />
              <span className="sr-only">Settings</span>
            </Link>
          )}
        </div>

        <div ref={full} className={styles.full}>
          <span className={styles.grab} aria-hidden />
          <div className={styles.top}>
            <div className={styles.titleRow}>
              <span className={styles.storyTitle}>{storyTitle}</span>
              <button
                type="button"
                className={styles.stripButton}
                onClick={toggle}
                data-tip="Hide the sidebar"
                data-keys="Ctrl+\"
              >
                <PanelIcon />
                <span className="sr-only">Hide the sidebar</span>
              </button>
            </div>
            <nav aria-label="Story pages" className={styles.list}>
              <Link href={overviewHref} className={`${styles.row} ${styles.pageRow}`} aria-current={currentIf(overviewHref)}>
                <HomeIcon />
                <span className={styles.name}>Overview</span>
              </Link>
              {member && (
                <Link
                  href={settingsHref}
                  className={`${styles.row} ${styles.pageRow}`}
                  aria-current={settingsCurrent}
                >
                  <SettingsIcon />
                  <span className={styles.name}>Settings</span>
                </Link>
              )}
              <SearchRow storyId={storyId} />
            </nav>
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
            <ChapterList
              storyId={storyId}
              chapters={chapters}
              chapterId={chapterId}
              here={here}
              chapterMenus={chapterMenus}
              reorderable={reorderable}
            />
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
            <BibleList
              storyId={storyId}
              entries={entries}
              typeOrder={typeOrder}
              entryId={entryId}
              here={here}
              entryMenus={entryMenus}
              typeMenus={typeMenus}
              reorderable={reorderable}
            />
            {entries.length === 0 && <p className={`muted ${styles.empty}`}>No Entries yet.</p>}
            {newEntry}
          </div>

          {here.length > 0 && (
            <section className={styles.here} aria-labelledby="sidebar-here">
              <h3 id="sidebar-here" className="smallcaps">
                Here now
              </h3>
              <ul className={styles.list}>
                {here.map((h) => {
                  const where = whereIs(h, chapters, entries);
                  return (
                    <li key={h.userId}>
                      <Link
                        href={`/stories/${storyId}/${h.kind === "chapter" ? "chapters" : "bible"}/${h.documentId}`}
                        scroll={false}
                        className={styles.hereRow}
                      >
                        <Avatar name={h.person.name} color={h.person.color} size="sm" />
                        <span className={styles.name}>{h.person.name}</span>
                        {where && <span className={styles.meta}>{where}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
        <SidebarResize fullRef={full} />
      </aside>
      {overlay && <div className={styles.scrim} onClick={close} aria-hidden />}
    </>
  );
}

const DEBOUNCE_MS = 150;

/**
 * Story search's box. Typing opens the Search page with one history entry, then refines it in place, so
 * Back leaves search; emptying the box goes Back. On the Search page the box follows `q`.
 */
function SearchRow({ storyId }: { storyId: string }) {
  const { searchRef, keepOverlay, close } = useDeskFrame();
  const router = useRouter();
  const pathname = usePathname();
  const searchHref = `/stories/${storyId}/search`;
  const onSearch = pathname === searchHref;
  const params = useSearchParams();
  const urlQuery = onSearch ? (params.get("q") ?? "") : null;
  const [text, setText] = useState(urlQuery ?? "");
  const [sent, setSent] = useState(urlQuery);
  const [seen, setSeen] = useState(urlQuery);
  const searching = useRef(onSearch);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back, Forward or a link changed the query: follow it, unless it's the one this box just sent.
  if (urlQuery !== seen) {
    setSeen(urlQuery);
    if (urlQuery !== sent) setText(urlQuery ?? "");
  }

  useEffect(() => {
    searching.current = onSearch;
  }, [onSearch]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (value: string) => {
    clearTimeout(timer.current);
    setSent(value);
    if (!value.trim()) {
      if (searching.current) {
        searching.current = false;
        router.back();
      }
      return;
    }
    const href = `${searchHref}?q=${encodeURIComponent(value)}`;
    if (searching.current) {
      router.replace(href, { scroll: false });
    } else {
      searching.current = true;
      keepOverlay(searchHref);
      router.push(href);
    }
  };

  const change = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    if (value.trim()) timer.current = setTimeout(() => go(value), DEBOUNCE_MS);
    else go(value);
  };

  return (
    <form
      role="search"
      className={`${styles.row} ${styles.searchRow}`}
      data-current={onSearch || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        go(text);
        searchRef.current?.blur();
        close();
      }}
    >
      <SearchIcon />
      <input
        ref={searchRef}
        type="text"
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && text) {
            // Clearing comes first; the next Escape closes the sidebar overlay.
            e.stopPropagation();
            change("");
          }
        }}
        placeholder="Search"
        aria-label="Search this Story"
        autoComplete="off"
        enterKeyHint="search"
      />
      {text ? (
        <button type="button" className={styles.searchClear} onClick={() => change("")} aria-label="Clear search">
          ✕
        </button>
      ) : (
        <kbd aria-hidden>/</kbd>
      )}
    </form>
  );
}

function whereIs(h: HereNow, chapters: Chapter[], entries: Entry[]): string | null {
  if (h.kind === "chapter") {
    const i = chapters.findIndex((c) => c.id === h.documentId);
    return i < 0 ? null : `Ch. ${i + 1}`;
  }
  return entries.find((e) => e.id === h.documentId)?.name ?? null;
}

function PanelIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M8 4v12" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <path d="M3.5 9 10 3.5 16.5 9v7a1 1 0 0 1-1 1h-3v-5h-5v5h-3a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
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

function SearchIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <circle cx="8.75" cy="8.75" r="5" />
      <path d="m12.5 12.5 4 4" />
    </svg>
  );
}
