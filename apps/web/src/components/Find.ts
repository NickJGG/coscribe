import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findFolded, foldQuery, foldText, MIN_QUERY } from "@coscribe/editor";
import { touchedTextblocks } from "@/lib/touched-textblocks";
import styles from "./Find.module.css";

/** What to find, and which occurrence (1-based, in document order) is current. */
export type FindConfig = { query: string; current: number | null };

type FindState = FindConfig & {
  folded: string;
  /** Every match, plain; `set` adds the current one over it. */
  matches: DecorationSet;
  set: DecorationSet;
  count: number;
};

export const findKey = new PluginKey<FindState>("find");

/** The attribute on the current match's pieces, for scrolling to it. */
export const FIND_CURRENT = "data-find-current";

/**
 * Tints a Story search's matches with decorations, so nothing reaches Yjs or other people. Edits re-match
 * only the text blocks they touch; a `FindConfig` under `findKey` re-matches everything when the query
 * changes. A current occurrence past the last match falls back to the last.
 */
export const Find = Extension.create<FindConfig>({
  name: "find",

  addOptions() {
    return { query: "", current: null };
  },

  addProseMirrorPlugins() {
    const initial: FindConfig = { query: this.options.query, current: this.options.current };
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: (_, state) => {
            const folded = foldQuery(initial.query);
            return withCurrent(state.doc, { ...initial, folded }, decorateAll(state.doc, folded));
          },
          apply(tr, prev) {
            const config = tr.getMeta(findKey) as FindConfig | undefined;
            if (config) {
              const folded = foldQuery(config.query);
              const matches = folded === prev.folded ? prev.matches : decorateAll(tr.doc, folded);
              return withCurrent(tr.doc, { ...config, folded }, matches);
            }
            if (!tr.docChanged || prev.folded.length < MIN_QUERY) return prev;

            let matches = prev.matches.map(tr.mapping, tr.doc);
            for (const pos of touchedTextblocks(tr)) {
              const node = tr.doc.nodeAt(pos)!;
              matches = matches
                .remove(matches.find(pos, pos + node.nodeSize))
                .add(tr.doc, decorateBlock(node, pos, prev.folded));
            }
            return withCurrent(tr.doc, prev, matches);
          },
        },
        props: {
          decorations: (state) => findKey.getState(state)?.set,
        },
      }),
    ];
  },
});

function decorateAll(doc: ProseMirrorNode, folded: string): DecorationSet {
  if (folded.length < MIN_QUERY) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    decorations.push(...decorateBlock(node, pos, folded));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function decorateBlock(node: ProseMirrorNode, pos: number, folded: string): Decoration[] {
  return findFolded(foldText(node.textContent), folded).map((m) =>
    Decoration.inline(pos + 1 + m.from, pos + 1 + m.to, { class: styles.match })
  );
}

function withCurrent(
  doc: ProseMirrorNode,
  { query, current, folded }: FindConfig & { folded: string },
  matches: DecorationSet
): FindState {
  const all = matches.find().sort((a, b) => a.from - b.from);
  const hit = current ? all[Math.min(current, all.length) - 1] : undefined;
  const set = hit
    ? matches.add(doc, [Decoration.inline(hit.from, hit.to, { class: styles.current, [FIND_CURRENT]: "" })])
    : matches;
  return { query, current, folded, matches, set, count: all.length };
}
