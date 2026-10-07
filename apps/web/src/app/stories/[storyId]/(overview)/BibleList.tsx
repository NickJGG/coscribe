import Link from "next/link";
import { ENTRY_GROUP_LABEL, ENTRY_TYPES, type EntryType } from "@/lib/entries";
import styles from "./story.module.css";

type Entry = { id: string; type: EntryType; name: string };

/** The Story Bible grouped by type, each group alphabetical (as `entries` arrives). */
export function BibleList({ storyId, entries }: { storyId: string; entries: Entry[] }) {
  if (!entries.length) return <p className={`muted ${styles.empty}`}>No Entries yet.</p>;

  return ENTRY_TYPES.map((type) => {
    const group = entries.filter((e) => e.type === type);
    if (!group.length) return null;
    return (
      <div key={type} className={styles.bibleGroup}>
        <h3 className="smallcaps">{ENTRY_GROUP_LABEL[type]}</h3>
        <ul>
          {group.map((entry) => (
            <li key={entry.id}>
              <Link href={`/stories/${storyId}/bible/${entry.id}`}>{entry.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    );
  });
}
