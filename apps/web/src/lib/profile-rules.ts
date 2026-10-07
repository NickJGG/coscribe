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

export function isAuthorColor(value: string): value is AuthorColor {
  return (AUTHOR_COLORS as readonly string[]).includes(value);
}
