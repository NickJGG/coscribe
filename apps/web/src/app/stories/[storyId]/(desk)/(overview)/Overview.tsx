"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { useHereNow, type HereNow } from "@/components/StoryPresence";
import { useDeskFrame } from "../DeskFrame";
import styles from "./overview.module.css";

/** A card for each Writer here now, linking to what they have open. Nothing when nobody's here. */
export function WritingNow({
  storyId,
  chapters,
  entries,
  member,
}: {
  storyId: string;
  chapters: { id: string; title: string }[];
  entries: { id: string; name: string }[];
  member: boolean;
}) {
  const here = useHereNow();
  if (!here.length) return null;

  return (
    <section className={styles.section} aria-labelledby="overview-writing-now">
      <h2 id="overview-writing-now" className={`smallcaps ${styles.liveHeading}`}>
        Writing now
      </h2>
      {here.map((h) => {
        const where = whereIs(h, chapters, entries);
        return (
          <Link
            key={h.userId}
            href={`/stories/${storyId}/${h.kind === "chapter" ? "chapters" : "bible"}/${h.documentId}`}
            className={styles.card}
          >
            <Avatar name={h.person.name} color={h.person.color} />
            <span className={styles.cardText}>
              <span className={styles.cardName}>{h.person.name}</span>
              {where && <span className={styles.cardWhere}>{where}</span>}
            </span>
            <span className={styles.cardGo}>{member ? "Join" : "Watch"} &rarr;</span>
          </Link>
        );
      })}
    </section>
  );
}

function whereIs(h: HereNow, chapters: { id: string; title: string }[], entries: { id: string; name: string }[]) {
  if (h.kind === "chapter") {
    const i = chapters.findIndex((c) => c.id === h.documentId);
    return i < 0 ? null : `in Chapter ${i + 1} · ${chapters[i].title}`;
  }
  const entry = entries.find((e) => e.id === h.documentId);
  return entry ? `in the Story Bible · ${entry.name}` : null;
}

/** Marks a Writer who's in this Story right now. */
export function HereDot({ userId }: { userId: string }) {
  const here = useHereNow().some((h) => h.userId === userId);
  if (!here) return null;
  return (
    <span className={styles.hereDot} title="Here now">
      <span className="sr-only">Here now</span>
    </span>
  );
}

export function BrowseButton() {
  const { open } = useDeskFrame();
  return (
    <div className={styles.browse}>
      <button type="button" className="button" onClick={() => open("chapters")}>
        Browse Chapters and the Story Bible
      </button>
    </div>
  );
}
