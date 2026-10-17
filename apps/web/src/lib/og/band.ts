import type { RibbonSegment } from "@/components/ContributionRibbon";

export type BandSegment = { color: string; grow: number };

/** Former Writers have no Author Color: the paper's faint ink. */
export const FORMER_WRITER_COLOR = "#9a9389";

/**
 * A share card's bottom band: the Contribution Ribbon, split by surviving characters. A Story with no text
 * yet splits it evenly across its members' colors instead.
 */
export function bandSegments(ribbon: RibbonSegment[], memberColors: string[]): BandSegment[] {
  const written = ribbon.filter((s) => s.chars > 0);
  if (written.length) return written.map((s) => ({ color: s.color ?? FORMER_WRITER_COLOR, grow: s.chars }));
  return memberColors.map((color) => ({ color, grow: 1 }));
}
