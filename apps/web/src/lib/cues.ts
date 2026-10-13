/** Character cue suggestions in a Script's Character lines. */

export const CUES_SHOWN = 6;

/** A cue already typed in the Story, and where: a Chapter title, or null for the open Chapter. */
export type UsedCue = { cue: string; chapter: string | null };

export type CueOption = { cue: string; note: string | null };

/** Whether any word of `text` starts with `query`, ignoring case. */
export function cueMatches(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + 1)) {
    if (i === 0 || /[^\p{L}\p{N}]/u.test(t[i - 1]!)) return true;
  }
  return false;
}

/**
 * Character Entries matching `query`, a row per name and per Alias, then used cues that aren't already an
 * Entry's name or Alias.
 */
export function cueOptions(
  query: string,
  characters: { name: string; aliases: string[] }[],
  used: UsedCue[]
): CueOption[] {
  const q = query.trim();
  if (!q) return [];
  const options: CueOption[] = [];
  const known = new Set<string>();
  for (const { name, aliases } of characters) {
    known.add(name.toLowerCase());
    if (cueMatches(name, q)) options.push({ cue: name, note: null });
    for (const alias of aliases) {
      known.add(alias.toLowerCase());
      if (cueMatches(alias, q)) options.push({ cue: alias, note: `Alias of ${name}` });
    }
  }
  for (const { cue, chapter } of used) {
    const key = cue.toLowerCase();
    if (known.has(key)) continue;
    known.add(key);
    if (cueMatches(cue, q)) options.push({ cue, note: chapter === null ? "Used in this Chapter" : `Used in ${chapter}` });
  }
  return options.slice(0, CUES_SHOWN);
}
