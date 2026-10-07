/** Accepts only same-site paths, so `?next=` can't be used as an open redirect. */
export function safeNext(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}
