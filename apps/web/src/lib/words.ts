/** A Chapter's length for the desk sidebar: exact under 100 words, then thousands to one decimal ("3.1k"). */
export function shortWords(words: number): string {
  return words < 100 ? String(words) : `${(words / 1000).toFixed(1)}k`;
}
