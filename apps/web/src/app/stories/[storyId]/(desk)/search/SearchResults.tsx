"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { foldQuery, MIN_QUERY, type FindMatch } from "@coscribe/editor";
import { ENTRY_TYPE_LABEL } from "@/lib/entries";
import type { ChapterResult, EntryResult, SearchResults as Results, Snippet } from "@/lib/search";
import { useStorySearch } from "@/components/StorySearch";
import styles from "./search.module.css";

const SHOWN = 3;

export function SearchResults({ storyId }: { storyId: string }) {
  const raw = useSearchParams().get("q") ?? "";
  const query = raw.trim();
  const { status, load, search } = useStorySearch();
  const results = useMemo(() => search(query), [search, query]);

  useEffect(load, [load]);

  const find = (path: string, n?: number | null) =>
    `/stories/${storyId}/${path}?find=${encodeURIComponent(query)}${n ? `&n=${n}` : ""}`;

  let body: React.ReactNode;
  if (foldQuery(query).length < MIN_QUERY) {
    body = <p className="muted">Type at least {MIN_QUERY} letters to search this Story.</p>;
  } else if (!results) {
    body =
      status === "failed" ? (
        <p className="muted">
          Search isn&rsquo;t available right now.{" "}
          <button type="button" className={styles.retry} onClick={load}>
            Try again
          </button>
        </p>
      ) : (
        <p className="muted">Searching…</p>
      );
  } else if (!results.chapters.length && !results.entries.length) {
    body = <p className="muted">Nothing matches &ldquo;{query}&rdquo; in this Story.</p>;
  } else {
    body = (
      <>
        <p className={styles.summary} role="status">
          {summary(query, results)}
        </p>
        {results.chapters.length > 0 && (
          <ol className={styles.groups}>
            {results.chapters.map((chapter) => (
              <ChapterGroup key={chapter.id} chapter={chapter} find={find} />
            ))}
          </ol>
        )}
        {results.entries.length > 0 && (
          <section className={styles.bible} aria-labelledby="search-bible">
            <h2 id="search-bible" className="smallcaps">
              Story Bible
            </h2>
            <ul className={styles.entries}>
              {results.entries.map((entry) => (
                <EntryResultRow key={entry.id} entry={entry} find={find} />
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Search</h1>
      {body}
    </div>
  );
}

type Find = (path: string, n?: number | null) => string;

function ChapterGroup({ chapter, find }: { chapter: ChapterResult; find: Find }) {
  const [expanded, setExpanded] = useState(false);
  const path = `chapters/${chapter.id}`;
  const shown = expanded ? chapter.snippets : chapter.snippets.slice(0, SHOWN);
  const more = chapter.snippets.length - SHOWN;

  return (
    <li className={styles.group}>
      <Link href={find(path)} className={styles.groupHead}>
        <span className={styles.num}>{chapter.number}</span>
        <span className={styles.groupTitle}>
          <Highlighted text={chapter.title} matches={chapter.titleMatches} />
        </span>
        {chapter.count > 0 && <span className={styles.count}>{matches(chapter.count)}</span>}
      </Link>
      {shown.length > 0 && (
        <ul className={styles.snippets}>
          {shown.map((s) => (
            <li key={s.n}>
              <SnippetLink snippet={s} href={find(path, s.n)} />
            </li>
          ))}
        </ul>
      )}
      {more > 0 && (
        <button type="button" className={styles.more} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? "Show fewer" : `Show ${more} more`}
        </button>
      )}
    </li>
  );
}

function EntryResultRow({ entry, find }: { entry: EntryResult; find: Find }) {
  const path = `bible/${entry.id}`;
  const meta = [ENTRY_TYPE_LABEL[entry.type], entry.fields.join(", "), entry.count > 0 && matches(entry.count)];

  return (
    <li className={styles.entry}>
      <Link href={find(path)} className={styles.entryHead}>
        <span className={styles.entryName}>
          <Highlighted text={entry.name} matches={entry.nameMatches} />
        </span>
        <span className={styles.entryMeta}>{meta.filter(Boolean).join(" · ")}</span>
      </Link>
      {entry.snippet && <SnippetLink snippet={entry.snippet} href={find(path, entry.snippet.n)} />}
    </li>
  );
}

function SnippetLink({ snippet, href }: { snippet: Snippet; href: string }) {
  return (
    <Link href={href} className={styles.snippet}>
      {snippet.before}
      <mark>{snippet.match}</mark>
      {snippet.after}
    </Link>
  );
}

function Highlighted({ text, matches }: { text: string; matches: FindMatch[] }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const { from, to } of matches) {
    parts.push(text.slice(at, from), <mark key={from}>{text.slice(from, to)}</mark>);
    at = to;
  }
  parts.push(text.slice(at));
  return parts;
}

function matches(n: number) {
  return n === 1 ? "1 match" : `${n.toLocaleString("en-US")} matches`;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function summary(query: string, { total, chapters, entries }: Results): React.ReactNode {
  const quoted = <>&ldquo;{query}&rdquo;</>;
  if (!total) {
    const parts = [
      chapters.length > 0 && plural(chapters.length, "Chapter", "Chapters"),
      entries.length > 0 && plural(entries.length, "Entry", "Entries"),
    ].filter(Boolean);
    const by = chapters.length && entries.length ? "by title or name" : chapters.length ? "by title" : "by name";
    return (
      <>
        {quoted} matches {parts.join(" and ")} {by}
      </>
    );
  }
  const inChapters = chapters.filter((c) => c.count > 0).length;
  const inEntries = entries.filter((e) => e.count > 0).length;
  const where = [
    inChapters > 0 && plural(inChapters, "Chapter", "Chapters"),
    inEntries > 0 && plural(inEntries, "Entry", "Entries"),
  ].filter(Boolean);
  return (
    <>
      {matches(total)} for {quoted} in {where.join(" and ")}
    </>
  );
}
