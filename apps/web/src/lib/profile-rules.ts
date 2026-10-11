export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Picked to work both as a live cursor color and as a light text tint. */
export const AUTHOR_COLORS = [
  "#d93f4c",
  "#e2621b",
  "#c99000",
  "#3f9b4f",
  "#12a594",
  "#0b8fd6",
  "#3e63dd",
  "#6e56cf",
  "#ab4aba",
  "#d6409f",
  "#8d6748",
  "#5b6672",
] as const;

export type AuthorColor = (typeof AUTHOR_COLORS)[number];

/** Lighter twins of AUTHOR_COLORS, tuned to read on the dark theme's paper. */
export const AUTHOR_COLOR_DARK: Record<AuthorColor, string> = {
  "#d93f4c": "#f2737c",
  "#e2621b": "#f58c50",
  "#c99000": "#e6b740",
  "#3f9b4f": "#6cc17c",
  "#12a594": "#4cc9b7",
  "#0b8fd6": "#5bb6ee",
  "#3e63dd": "#8098f0",
  "#6e56cf": "#a08ce9",
  "#ab4aba": "#cd80d8",
  "#d6409f": "#ec7cc0",
  "#8d6748": "#bf9a78",
  "#5b6672": "#97a1ac",
};

export const AUTHOR_COLOR_NAMES: Record<AuthorColor, string> = {
  "#d93f4c": "red",
  "#e2621b": "orange",
  "#c99000": "amber",
  "#3f9b4f": "green",
  "#12a594": "teal",
  "#0b8fd6": "sky",
  "#3e63dd": "blue",
  "#6e56cf": "violet",
  "#ab4aba": "purple",
  "#d6409f": "pink",
  "#8d6748": "brown",
  "#5b6672": "slate",
};

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Returns an error message, or null when the (normalized) username is valid. */
export function usernameError(username: string): string | null {
  if (username.length < 3) return "Usernames need at least 3 characters.";
  if (username.length > 20) return "Usernames can be at most 20 characters.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Use only lowercase letters, numbers, and underscores.";
  }
  return null;
}

export const BIO_MAX = 160;

/** Trims and collapses whitespace to a single line; blank means no Bio. */
export function normalizeBio(raw: string): string | null {
  return raw.replace(/\s+/g, " ").trim() || null;
}

/** Returns an error message, or null when the (normalized) Bio is valid. */
export function bioError(bio: string | null): string | null {
  if (bio && bio.length > BIO_MAX) return `Bios can be at most ${BIO_MAX} characters.`;
  return null;
}

export function isAuthorColor(value: string): value is AuthorColor {
  return (AUTHOR_COLORS as readonly string[]).includes(value);
}

export function colorName(hex: string): string {
  return isAuthorColor(hex) ? AUTHOR_COLOR_NAMES[hex] : hex;
}

/** Both theme variants of an Author Color. A color outside the palette is used as-is in both. */
export function authorColorVars(hex: string): { light: string; dark: string } {
  return { light: hex, dark: isAuthorColor(hex) ? AUTHOR_COLOR_DARK[hex] : hex };
}

/** An Author Color as a CSS value that follows the theme (via `color-scheme`). */
export function authorColorCss(hex: string): string {
  const { light, dark } = authorColorVars(hex);
  return `light-dark(${light}, ${dark})`;
}

/**
 * A Writer's color in a Story: their preferred color if no other member has it, else the next free one
 * after it in palette order (the palette is hue-ordered, so that's the nearest). Mirrors
 * `public.next_free_color` in supabase/migrations/0009_story_colors.sql.
 */
export function nextFreeColor(palette: readonly string[], taken: Iterable<string>, preferred: string): string {
  const used = new Set(taken);
  if (!used.has(preferred)) return preferred;
  const start = palette.indexOf(preferred);
  for (let i = 1; i <= palette.length; i++) {
    const candidate = palette[(start + i) % palette.length]!;
    if (!used.has(candidate)) return candidate;
  }
  return preferred;
}
