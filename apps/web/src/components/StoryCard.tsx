import Link from "next/link";
import { ROLE_LABEL, type MemberRole } from "@/lib/story-roles";
import { readingTime } from "@/lib/words";
import { ContributionRibbon, type RibbonSegment } from "@/components/ContributionRibbon";
import { Bar, Line } from "@/components/Skeleton";
import styles from "./StoryCard.module.css";

/**
 * A Finished Story as a bound book, anything else as a loose manuscript, with its ribbon as the spine
 * (only `lit` Writers in colour, when given). The top line shows only with a `role` or `private`;
 * `children` is the foot.
 */
export function StoryCard({
  href,
  title,
  blurb,
  finished,
  role,
  private: isPrivate,
  ribbon,
  lit,
  children,
}: {
  href: string;
  title: string;
  blurb: string | null;
  finished: boolean;
  role?: MemberRole;
  private?: boolean;
  ribbon: RibbonSegment[];
  lit?: ReadonlySet<string>;
  children: React.ReactNode;
}) {
  return (
    <li className={`${styles.card} ${finished ? styles.book : styles.manuscript}`}>
      <span className={styles.spine}>
        <ContributionRibbon segments={ribbon} lit={lit} vertical />
      </span>
      <div className={styles.body}>
        {(role || isPrivate) && (
          <span className={styles.role}>
            {role && ROLE_LABEL[role]}
            {isPrivate && (
              <span className={styles.private}>
                <svg className={styles.lock} viewBox="0 0 12 12" aria-hidden>
                  <rect x="2.5" y="5.5" width="7" height="5" rx="1" />
                  <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
                </svg>
                Private
              </span>
            )}
          </span>
        )}
        <Link href={href} className={styles.title}>
          {title}
        </Link>
        {blurb && <p className={styles.blurb}>{blurb}</p>}
        <span className={styles.foot}>{children}</span>
      </div>
    </li>
  );
}

/** A Finished Story's foot: "12 Chapters · 2 hr 45 min read". */
export function finishedFoot(chapterCount: number, words: number): string {
  const read = readingTime(words);
  return `${chapterCount} ${chapterCount === 1 ? "Chapter" : "Chapters"}${read ? ` · ${read} read` : ""}`;
}

export function StoryGrid({ children }: { children: React.ReactNode }) {
  return <ul className={styles.grid}>{children}</ul>;
}

/** A titled grid of StoryCards; `title` may be a skeleton Bar. */
export function StorySection({
  title,
  count,
  children,
}: {
  title: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2>
        {title}
        {count !== undefined && <span className={styles.count}>{count}</span>}
      </h2>
      <StoryGrid>{children}</StoryGrid>
    </section>
  );
}

export function StoryCardSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <li className={`${styles.card} ${styles.manuscript}`}>
      <span className={styles.spine} />
      <div className={styles.body}>
        <Line className={styles.role} width="3rem" />
        <Line className={styles.title} width={titleWidth} />
        <Line className={styles.blurb} width="100%" />
        <Line className={styles.foot} width="7rem" />
      </div>
    </li>
  );
}

export function StorySectionSkeleton({ titleWidth, cards }: { titleWidth: string; cards: string[] }) {
  return (
    <StorySection title={<Bar width={titleWidth} />}>
      {cards.map((width, i) => (
        <StoryCardSkeleton key={i} titleWidth={width} />
      ))}
    </StorySection>
  );
}
