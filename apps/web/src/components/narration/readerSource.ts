import type { JSONContent } from "@tiptap/core";
import {
  chapterIntro,
  chapterSchema,
  narratedBlocks,
  narrationUnits,
  THE_END,
  unitAt,
  type NarrationUnit,
} from "@coscribe/editor";
import type { EntryMentionEntry } from "@/lib/entries";
import { speakersOf, type NarrationCursor, type NarrationSource } from "./NarrationProvider";

const HIGHLIGHT = "narration";

function unitsOf(content: JSONContent, characters: readonly EntryMentionEntry[]): NarrationUnit[] {
  try {
    return narrationUnits(chapterSchema.nodeFromJSON(content), characters);
  } catch {
    return [];
  }
}

/** The DOM range of `[from, to)` in a `ProseView` block's text, where a line break counts as one character. */
function rangeIn(block: Element, from: number, to: number): Range | null {
  const range = document.createRange();
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let at = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element) {
      if (node.tagName === "BR") at += 1;
      continue;
    }
    const length = node.textContent?.length ?? 0;
    if (!started && from <= at + length) {
      range.setStart(node, from - at);
      started = true;
    }
    if (started && to <= at + length) {
      range.setEnd(node, to - at);
      return range;
    }
    at += length;
  }
  return null;
}

/**
 * A Finished Chapter in the Reader View, as `ProseView positions` rendered it inside `container`: its intro, its
 * text, and "The End." after the Story's last Chapter. The highlight is a CSS Custom Highlight, so the
 * server-rendered text is never touched.
 */
export function readerSource({
  storyId,
  content,
  number,
  title,
  characters,
  last,
  container,
  onEnd,
}: {
  storyId: string;
  content: JSONContent;
  number: number;
  title: string;
  characters: readonly EntryMentionEntry[];
  last: boolean;
  container: () => HTMLElement | null;
  onEnd: () => boolean;
}): NarrationSource {
  const units = [chapterIntro(number, title), ...unitsOf(content, characters), ...(last ? [THE_END] : [])];
  const blocks = narratedBlocks(units);
  const speakers = speakersOf(units);
  const cursorAt = (i: number): NarrationCursor | null => (i >= 0 && i < units.length ? { unit: units[i]!, anchor: i } : null);
  const blockElement = (block: number) => container()?.querySelector(`[data-block="${block}"]`) ?? null;
  const rangeOf = (unit: NarrationUnit) => {
    const element = unit.from < unit.to ? blockElement(unit.block) : null;
    return element && rangeIn(element, unit.from, unit.to);
  };

  return {
    storyId,
    title: `Chapter ${number} · ${title}`,
    characters,
    speakers: () => speakers,
    next: (cursor) => cursorAt(cursor ? (cursor.anchor as number) + 1 : 0),
    at: (block) => cursorAt(unitAt(units, block)),
    blocks: () => blocks,
    highlight(unit) {
      if (typeof CSS === "undefined" || !CSS.highlights) return;
      const range = unit && rangeOf(unit);
      if (range) CSS.highlights.set(HIGHLIGHT, new Highlight(range));
      else CSS.highlights.delete(HIGHLIGHT);
    },
    rect(unit) {
      if (unit.block < 0) return null;
      return (rangeOf(unit) ?? blockElement(unit.block))?.getBoundingClientRect() ?? null;
    },
    scroller: () => null,
    container,
    blockAt(target) {
      const block = target.closest<HTMLElement>("[data-block]");
      return block && container()?.contains(block) ? Number(block.dataset.block) : null;
    },
    onEnd,
  };
}
