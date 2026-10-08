const monthYearFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "March 2026". */
export function monthYear(at: string): string {
  return monthYearFormat.format(new Date(at));
}

/** The `count` most recently edited Chapters, newest first, with their reading-order numbers. Never-edited ones are left out. */
export function recentlyEdited<C extends { edited_at: string | null }>(
  chapters: C[],
  count = 3
): { chapter: C; number: number }[] {
  return chapters
    .map((chapter, i) => ({ chapter, number: i + 1 }))
    .filter(({ chapter }) => chapter.edited_at)
    .sort((a, b) => b.chapter.edited_at!.localeCompare(a.chapter.edited_at!))
    .slice(0, count);
}
