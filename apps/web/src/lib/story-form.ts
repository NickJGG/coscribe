export const BLURB_MAX = 280;

/** The create and settings forms' fields, trimmed, with the first problem as `error`. An empty Blurb is null. */
export function readStoryForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const visibility = formData.get("visibility") === "public" ? "public" : "private";
  const blurb = String(formData.get("blurb") ?? "").trim() || null;
  const error = !title
    ? "Give the story a title."
    : title.length > 120
      ? "Keep titles under 120 characters."
      : blurb && blurb.length > BLURB_MAX
        ? `Keep the blurb under ${BLURB_MAX} characters.`
        : null;
  return { title, visibility, blurb, error } as const;
}
