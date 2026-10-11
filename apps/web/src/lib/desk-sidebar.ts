/**
 * The desk sidebar's per-browser width and collapsed state, kept in cookies so the server paints them on a
 * hard load. One width serves every Story.
 */

export const WIDTH_COOKIE = "coscribe-sidebar-width";
export const COLLAPSED_COOKIE = "coscribe-sidebar-collapsed";
/** 16rem: the default, and the narrowest the sidebar gets. */
export const SIDEBAR_MIN_PX = 256;
export const SIDEBAR_STEP_PX = 16;

const YEAR_SECONDS = 365 * 24 * 60 * 60;

/** A stored width in px, or `null` for the default. */
export function parseSidebarWidth(raw?: string): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= SIDEBAR_MIN_PX ? n : null;
}

export function parseCollapsed(raw?: string): boolean {
  return raw === "1";
}

/** A `document.cookie` assignment; `null` clears the cookie. */
export function sidebarCookie(name: string, value: string | null): string {
  return value === null
    ? `${name}=; path=/; max-age=0; samesite=lax`
    : `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}
