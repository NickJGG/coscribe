import { Extension } from "@tiptap/core";
import { isChangeOrigin } from "@tiptap/extension-collaboration";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { absolutePositionToRelativePosition, relativePositionToAbsolutePosition, ySyncPluginKey } from "@tiptap/y-tiptap";
import styles from "./Narration.module.css";

/**
 * A position in a live document that survives others' edits, as a Yjs relative position. Mapping isn't enough:
 * y-tiptap replaces the whole document on every remote change.
 */
export type LivePosition = { readonly live: unknown };

export function livePosition(state: EditorState, pos: number): LivePosition | null {
  const y = ySyncPluginKey.getState(state);
  return y?.binding ? { live: absolutePositionToRelativePosition(pos, y.type, y.binding.mapping) } : null;
}

export function resolveLive(state: EditorState, position: LivePosition | null): number | null {
  const y = ySyncPluginKey.getState(state);
  if (!position || !y?.binding) return null;
  const pos = relativePositionToAbsolutePosition(y.doc, y.type, position.live, y.binding.mapping);
  return pos === null ? null : Math.min(pos, state.doc.content.size);
}

/** The text being read, or null; dispatched under `narrationKey`. */
export type NarrationRange = { from: number; to: number } | null;

type Reading = { from: LivePosition | null; to: LivePosition | null; set: DecorationSet } | null;

export const narrationKey = new PluginKey<Reading>("narration");

function tint(state: EditorState, from: number, to: number) {
  return DecorationSet.create(state.doc, [Decoration.inline(from, to, { class: styles.reading })]);
}

/** Tints the sentence Narration is reading, keeping it on the same words as others edit around them. */
export const Narration = Extension.create({
  name: "narration",

  addProseMirrorPlugins() {
    return [
      new Plugin<Reading>({
        key: narrationKey,
        state: {
          init: () => null,
          apply(tr, prev, _, state) {
            const range = tr.getMeta(narrationKey) as NarrationRange | undefined;
            if (range !== undefined) {
              return range && { from: livePosition(state, range.from), to: livePosition(state, range.to), set: tint(state, range.from, range.to) };
            }
            if (!prev || !tr.docChanged) return prev;
            if (!isChangeOrigin(tr)) return { ...prev, set: prev.set.map(tr.mapping, tr.doc) };
            const from = resolveLive(state, prev.from);
            const to = resolveLive(state, prev.to);
            return from === null || to === null || from >= to ? { ...prev, set: DecorationSet.empty } : { ...prev, set: tint(state, from, to) };
          },
        },
        props: {
          decorations: (state) => narrationKey.getState(state)?.set,
        },
      }),
    ];
  },
});
