import type { Editor } from "@tiptap/core";
import {
  chapterIntro,
  narratedBlocks,
  narrationPoint,
  narrationPos,
  narrationUnits,
  unitAfter,
  unitAt,
  type NarrationUnit,
} from "@coscribe/editor";
import { livePosition, narrationKey, resolveLive, type LivePosition, type NarrationRange } from "../Narration";
import type { NarrationCursor, NarrationSource } from "./NarrationProvider";

/** Where a unit was, as live positions; null for the intro, which has no place. */
type Anchor = { from: LivePosition | null; to: LivePosition | null } | null;

export type DeskSource = NarrationSource & {
  /** Where to put the caret once Narration is over: the start of the sentence it stopped in, or the end of the last. */
  stoppedAt(): number | null;
};

/**
 * A Chapter open in the Desk, read from the live document: each unit is found afresh just before it's spoken,
 * after the end of the one before, so others' edits ahead are read and a deleted sentence is simply passed. It
 * stops at the Chapter's end.
 */
export function deskSource({
  editor,
  number,
  title,
  scroll,
}: {
  editor: Editor;
  number: number;
  title: string;
  /** The Desk's scrolling page. */
  scroll: { readonly current: HTMLElement | null } | null;
}): DeskSource {
  let last: Anchor = null;
  let ended = false;

  const units = () => narrationUnits(editor.state.doc);
  const range = ({ block, from, to }: NarrationUnit) => {
    const { doc } = editor.state;
    return { from: narrationPos(doc, block, from, 1), to: narrationPos(doc, block, to, -1) };
  };
  const cursorOf = (unit: NarrationUnit | undefined): NarrationCursor | null => {
    if (!unit) return null;
    const { from, to } = range(unit);
    const anchor: Anchor = { from: livePosition(editor.state, from), to: livePosition(editor.state, to) };
    return { unit, anchor };
  };
  const blockStart = (block: number) => narrationPos(editor.state.doc, block, 0);

  return {
    title: `Chapter ${number} · ${title}`,
    next(cursor) {
      if (!cursor) return { unit: chapterIntro(number, title), anchor: null };
      const all = units();
      const anchor = cursor.anchor as Anchor;
      if (!anchor) return cursorOf(all[0]);
      const end = resolveLive(editor.state, anchor.to);
      if (end === null) return null;
      const { block, offset } = narrationPoint(editor.state.doc, end);
      return cursorOf(all[unitAfter(all, block, offset)]);
    },
    refresh(cursor) {
      const anchor = cursor.anchor as Anchor;
      const from = anchor && resolveLive(editor.state, anchor.from);
      if (from === null) return cursor;
      const { block, offset } = narrationPoint(editor.state.doc, from);
      const all = units();
      return cursorOf(all[unitAt(all, block, offset)]);
    },
    at(block) {
      const all = units();
      return cursorOf(all[unitAt(all, block)]);
    },
    blocks: () => narratedBlocks(units()),
    highlight(unit) {
      if (editor.isDestroyed) return;
      const placed = unit && unit.block >= 0 ? range(unit) : null;
      if (placed) {
        last = { from: livePosition(editor.state, placed.from), to: livePosition(editor.state, placed.to) };
        ended = false;
      }
      const tinted: NarrationRange = placed && placed.from < placed.to ? placed : null;
      editor.view.dispatch(editor.state.tr.setMeta(narrationKey, tinted));
    },
    rect(unit) {
      if (unit.block < 0 || editor.isDestroyed) return null;
      const { view } = editor;
      try {
        if (unit.from === unit.to) return (view.nodeDOM(blockStart(unit.block)) as Element | null)?.getBoundingClientRect() ?? null;
        const { from, to } = range(unit);
        const start = view.domAtPos(from);
        const end = view.domAtPos(to);
        const dom = document.createRange();
        dom.setStart(start.node, start.offset);
        dom.setEnd(end.node, end.offset);
        return dom.getBoundingClientRect();
      } catch {
        return null;
      }
    },
    scroller: () => scroll?.current ?? null,
    container: () => (editor.isDestroyed ? null : editor.view.dom),
    blockAt(target) {
      const { view } = editor;
      if (editor.isDestroyed || target === view.dom || !view.dom.contains(target)) return null;
      try {
        return editor.state.doc.resolve(view.posAtDOM(target, 0)).index(0);
      } catch {
        return null;
      }
    },
    onEnd() {
      ended = true;
      return false;
    },
    stoppedAt() {
      return editor.isDestroyed || !last ? null : resolveLive(editor.state, ended ? last.to : last.from);
    },
  };
}
