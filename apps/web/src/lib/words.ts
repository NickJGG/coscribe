const WORDS_PER_MINUTE = 250;

/** Estimated reading time ("7 min", "2 hr 15 min", "14 hr"), or null for no words. */
export function readingTime(words: number): string | null {
  if (words <= 0) return null;
  const exact = words / WORDS_PER_MINUTE;
  if (Math.ceil(exact) < 60) return `${Math.ceil(exact)} min`;
  if (exact >= 600) return `${Math.round(exact / 60)} hr`;
  // Nearest 5 minutes past an hour; a round-up to 60 carries into the hour.
  const total = Math.round(exact / 5) * 5;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes && hours < 10 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}
