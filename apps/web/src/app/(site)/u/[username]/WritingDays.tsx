import Link from "next/link";
import { cellTip, daysInLastYear, heatmapWeeks, streaks, type HeatmapWeek, type WritingDay } from "@/lib/writing-days";
import styles from "./profile.module.css";

export type WritingHistory = { today: string; hidden: boolean; days: WritingDay[] };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The profile User's Writing Days heatmap and Streaks. `hidden` only reaches the owner. */
export function WritingDays({ history }: { history: WritingHistory }) {
  const { today, hidden, days } = history;
  const { current, longest } = streaks(days, today);
  const weeks = heatmapWeeks(days, today);
  const written = plural(daysInLastYear(days, today), "day");

  return (
    <section className={styles.heatmap}>
      <div className={styles.heatmapHead}>
        <span className={styles.label}>Writing days</span>
        <span className={styles.streaks}>
          <span>
            Current streak <b>{plural(current, "day")}</b>
          </span>
          <span>
            Longest <b>{plural(longest, "day")}</b>
          </span>
        </span>
      </div>
      <div className={styles.heatmapScroll}>
        <div className={styles.heatmapGrid} role="img" aria-label={`${written} written in the last year`}>
          {weeks.map((week) => (
            <Week key={week.days[0]!.date} week={week} />
          ))}
        </div>
      </div>
      <div className={styles.heatmapFoot}>
        <span>{written} written in the last year</span>
        <span className={styles.legend} aria-hidden>
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={styles.cell} data-level={l} />
          ))}
          <span>More</span>
        </span>
      </div>
      {hidden && (
        <p className={styles.note}>
          Only you can see this. <Link href="/settings">Show it on your profile</Link>
        </p>
      )}
    </section>
  );
}

function Week({ week }: { week: HeatmapWeek }) {
  return (
    <>
      <span className={styles.month}>{week.month}</span>
      {week.days.map((cell, d) =>
        cell ? (
          <span key={cell.date} className={styles.cell} data-level={cell.level} data-tip={cellTip(cell)} />
        ) : (
          <span key={d} />
        )
      )}
    </>
  );
}
