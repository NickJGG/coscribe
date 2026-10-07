"use client";

import { useState } from "react";
import Link from "next/link";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, filterEntries, type EntryType } from "@/lib/entries";
import styles from "./story.module.css";

type Entry = { id: string; type: EntryType; name: string; description: string };

/** The Story Bible, searchable by name and narrowed by type. */
export function BibleList({ storyId, entries }: { storyId: string; entries: Entry[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<EntryType | null>(null);
  const shown = filterEntries(entries, query, type);

  if (!entries.length) return <p className="muted">No Entries yet.</p>;

  return (
    <>
      <div className={styles.bibleFilters}>
        <input
          type="search"
          className="input"
          placeholder="Search by name"
          aria-label="Search the Story Bible"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={styles.typeFilter} role="group" aria-label="Entry type">
          {[null, ...ENTRY_TYPES].map((t) => (
            <button
              key={t ?? "all"}
              type="button"
              className="button button-small"
              aria-pressed={type === t}
              onClick={() => setType(t)}
            >
              {t ? ENTRY_TYPE_LABEL[t] : "All"}
            </button>
          ))}
        </div>
      </div>

      {shown.length ? (
        <ul className="rows">
          {shown.map((entry) => (
            <li key={entry.id} className={`row ${styles.entry}`}>
              <span className={styles.entryName}>
                <Link href={`/stories/${storyId}/bible/${entry.id}`}>{entry.name}</Link>
                <span className="pill">{ENTRY_TYPE_LABEL[entry.type]}</span>
              </span>
              {entry.description && <span className={`muted ${styles.entryDescription}`}>{entry.description}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No Entries match.</p>
      )}
    </>
  );
}
