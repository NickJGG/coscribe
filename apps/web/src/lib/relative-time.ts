const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". */
export function relativeTime(at: number, now = Date.now()): string {
  const seconds = Math.round((at - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit);
  }
  return "just now";
}

const DAY = 24 * 3600 * 1000;

/** "today", "tomorrow", "in 6 days", counting whole days left and rounding up. */
export function inDays(at: number, now = Date.now()): string {
  const days = Math.ceil((at - now) / DAY);
  if (days <= 0) return "today";
  return days === 1 ? "tomorrow" : `in ${days} days`;
}
