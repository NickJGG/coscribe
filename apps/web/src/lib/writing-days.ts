/**
 * The profile heatmap of Writing Days. Days are plain `YYYY-MM-DD` dates already in the User's time zone, so
 * all date math and formatting here is in UTC.
 */

/** `[day, minutes]`, as writing_history returns them, oldest first. */
export type WritingDay = [string, number];

export type HeatmapCell = { date: string; minutes: number; level: 0 | 1 | 2 | 3 | 4 };
/** A Sunday-first week; days after today are null. */
export type HeatmapWeek = { month: string | null; days: (HeatmapCell | null)[] };

export const HEATMAP_WEEKS = 53;
const DAY_MS = 86_400_000;

const toTime = (date: string) => Date.parse(`${date}T00:00:00Z`);
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => toDate(toTime(date) + n * DAY_MS);

function written(days: WritingDay[]): Map<string, number> {
  return new Map(days.filter(([, minutes]) => minutes > 0));
}

/** Current is still alive while yesterday was written and today isn't yet. Longest is all-time. */
export function streaks(days: WritingDay[], today: string): { current: number; longest: number } {
  const byDay = written(days);
  let current = 0;
  let day = byDay.has(today) ? today : addDays(today, -1);
  while (byDay.has(day)) {
    current++;
    day = addDays(day, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of [...byDay.keys()].sort()) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return { current, longest };
}

export function level(minutes: number): HeatmapCell["level"] {
  if (minutes <= 0) return 0;
  if (minutes <= 15) return 1;
  if (minutes <= 45) return 2;
  if (minutes <= 90) return 3;
  return 4;
}

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** `HEATMAP_WEEKS` columns ending on today's week, each labelled with the month it starts, if it's a new one. */
export function heatmapWeeks(days: WritingDay[], today: string): HeatmapWeek[] {
  const byDay = written(days);
  const start = addDays(today, -new Date(toTime(today)).getUTCDay() - (HEATMAP_WEEKS - 1) * 7);
  const weeks: HeatmapWeek[] = [];
  let lastMonth: string | null = null;

  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const sunday = addDays(start, w * 7);
    const month = monthFormat.format(toTime(sunday));
    // The first and last weeks' labels would collide with the next one or spill past the grid.
    const label = month !== lastMonth && w > 0 && w < HEATMAP_WEEKS - 2 ? month : null;
    lastMonth = month;
    weeks.push({
      month: label,
      days: Array.from({ length: 7 }, (_, d) => {
        const date = addDays(sunday, d);
        if (date > today) return null;
        const minutes = byDay.get(date) ?? 0;
        return { date, minutes, level: level(minutes) };
      }),
    });
  }
  return weeks;
}

/** Days written in the 365 days up to and including today. */
export function daysInLastYear(days: WritingDay[], today: string): number {
  const from = addDays(today, -364);
  return [...written(days).keys()].filter((date) => date >= from && date <= today).length;
}

/** "47 minutes writing on Tue, Oct 6" or "No writing on Tue, Oct 6". */
export function cellTip({ date, minutes }: HeatmapCell): string {
  const on = dayFormat.format(toTime(date));
  if (!minutes) return `No writing on ${on}`;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"} writing on ${on}`;
}
