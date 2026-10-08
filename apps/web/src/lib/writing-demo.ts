/** The front page's scripted demo: theo types the rest of his line, pauses, deletes it, pauses, repeats. */
export const DEMO_BASE = "Eleven. There were only ever ten";
export const DEMO_FULL = `${DEMO_BASE} bells on the spit, and Wren had painted every one of them.`;

const END_PAUSE = 30;
const START_PAUSE = 12;

/** How many characters of `DEMO_FULL` show at a given tick. Tick 0 is the still frame. */
export function demoLength(tick: number): number {
  const span = DEMO_FULL.length - DEMO_BASE.length;
  const t = tick % (2 * span + END_PAUSE + START_PAUSE);
  if (t <= span) return DEMO_BASE.length + t;
  if (t <= span + END_PAUSE) return DEMO_FULL.length;
  if (t <= 2 * span + END_PAUSE) return DEMO_FULL.length - (t - span - END_PAUSE);
  return DEMO_BASE.length;
}
