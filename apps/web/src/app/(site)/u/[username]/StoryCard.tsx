import Link from "next/link";
import type { ProfileStory } from "@/lib/profile";
import { ROLE_LABEL } from "@/lib/story-roles";
import { readingTime } from "@/lib/words";
import { relativeTime } from "@/lib/relative-time";
import { ContributionRibbon } from "@/components/ContributionRibbon";
import { LiveCounts } from "@/components/LiveCounts";
import styles from "./profile.module.css";

/** A Finished Story as a bound book, anything else as a loose manuscript; the spine lights only `lit` Writers. */
export function StoryCard({ story, lit }: { story: ProfileStory; lit: ReadonlySet<string> }) {
  const finished = story.status === "finished";
  const read = readingTime(story.words);

  return (
    <li className={`${styles.card} ${finished ? styles.book : styles.manuscript}`}>
      <span className={styles.spine}>
        <ContributionRibbon segments={story.ribbon} lit={lit} vertical />
      </span>
      <div className={styles.body}>
        <span className={styles.role}>
          {ROLE_LABEL[story.role]}
          {story.visibility === "private" && (
            <span className={styles.private}>
              <svg className={styles.lock} viewBox="0 0 12 12" aria-hidden>
                <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
                <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
              </svg>
              Private
            </span>
          )}
        </span>
        <Link href={`/stories/${story.id}${finished ? "/read" : ""}`} className={styles.title}>
          {story.title}
        </Link>
        {story.blurb && <p className={styles.blurb}>{story.blurb}</p>}
        <span className={styles.foot}>
          {finished ? (
            <>
              {story.chapterCount} {story.chapterCount === 1 ? "Chapter" : "Chapters"}
              {read && ` · ${read} read`}
            </>
          ) : story.writers > 0 ? (
            <LiveCounts writers={story.writers} viewers={story.viewers} />
          ) : story.words > 0 && story.editedAt ? (
            `Edited ${relativeTime(Date.parse(story.editedAt))}`
          ) : (
            "No words yet"
          )}
        </span>
      </div>
    </li>
  );
}
