"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findMentions } from "@coscribe/editor";
import { ENTRY_TYPE_LABEL, type MentionEntry } from "@/lib/entries";
import { getEntryPreview } from "@/lib/actions/entries";
import { touchedTextblocks } from "@/lib/touched-textblocks";
import styles from "./Mentions.module.css";

/** Which Entries to underline, and whether Mentions take keyboard focus (only when the text isn't editable). */
export type MentionConfig = { entries: MentionEntry[]; focusable: boolean };

type MentionState = MentionConfig & { set: DecorationSet };

export const mentionKey = new PluginKey<MentionState>("mentions");

/**
 * Underlines Mentions with decorations, so the document schema (and apps/sync) never sees them, and turns
 * spellcheck off over every name and Alias, linked or not. Edits re-match only the text blocks they touch;
 * a transaction with a `MentionConfig` under `mentionKey` re-matches everything.
 */
export const Mentions = Extension.create<MentionConfig>({
  name: "mentions",

  addOptions() {
    return { entries: [], focusable: false };
  },

  addProseMirrorPlugins() {
    const initial: MentionConfig = { entries: this.options.entries, focusable: this.options.focusable };
    return [
      new Plugin<MentionState>({
        key: mentionKey,
        state: {
          init: (_, state) => ({ ...initial, set: decorateAll(state.doc, initial) }),
          apply(tr, prev) {
            const config = tr.getMeta(mentionKey) as MentionConfig | undefined;
            if (config) return { ...config, set: decorateAll(tr.doc, config) };
            if (!tr.docChanged) return prev;

            let set = prev.set.map(tr.mapping, tr.doc);
            for (const pos of touchedTextblocks(tr)) {
              const node = tr.doc.nodeAt(pos)!;
              set = set.remove(set.find(pos, pos + node.nodeSize)).add(tr.doc, decorateBlock(node, pos, prev));
            }
            return { ...prev, set };
          },
        },
        props: {
          decorations: (state) => mentionKey.getState(state)?.set,
        },
      }),
    ];
  },
});

function decorateAll(doc: ProseMirrorNode, config: MentionConfig): DecorationSet {
  if (!config.entries.length) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    decorations.push(...decorateBlock(node, pos, config));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function decorateBlock(node: ProseMirrorNode, pos: number, { entries, focusable }: MentionConfig): Decoration[] {
  if (!entries.length) return [];
  return findMentions(node.textContent, entries).map((m) =>
    Decoration.inline(
      pos + 1 + m.from,
      pos + 1 + m.to,
      m.linked
        ? { class: styles.mention, "data-mention": m.entryId, spellcheck: "false", ...(focusable && { tabindex: "0" }) }
        : { spellcheck: "false" }
    )
  );
}

type Card = { entry: MentionEntry; x: number; y: number };

const OPEN_MS = 300;
const CLOSE_MS = 200;

/**
 * Hovering or focusing a Mention inside `children` shows a read-only card for its Entry. The body's
 * opening lines load on first open and are kept for the rest of the visit.
 */
export function MentionCards({
  storyId,
  entries,
  children,
}: {
  storyId: string;
  entries: MentionEntry[];
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const previews = useRef(new Map<string, Promise<string | null>>());
  const [card, setCard] = useState<Card | null>(null);
  const [preview, setPreview] = useState<{ id: string; text: string | null } | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!card) return;
    const id = card.entry.id;
    let request = previews.current.get(id);
    if (!request) {
      request = getEntryPreview(storyId, id).catch(() => null);
      previews.current.set(id, request);
    }
    let live = true;
    request.then((text) => live && setPreview({ id, text }));
    return () => {
      live = false;
    };
  }, [card, storyId]);

  function later(fn: () => void, ms: number) {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }

  function open(target: EventTarget, delay: number) {
    const mention = (target as Element).closest<HTMLElement>("[data-mention]");
    if (!mention || !box.current) return false;
    const entry = entries.find((e) => e.id === mention.dataset.mention);
    if (!entry) return false;
    const origin = box.current.getBoundingClientRect();
    const rect = mention.getClientRects()[0] ?? mention.getBoundingClientRect();
    const next = { entry, x: rect.left - origin.left, y: rect.bottom - origin.top };
    later(() => setCard((c) => (c?.entry.id === entry.id ? c : next)), delay);
    return true;
  }

  function close(delay = CLOSE_MS) {
    later(() => setCard(null), delay);
  }

  const shown = card && preview?.id === card.entry.id ? preview.text : undefined;

  return (
    <div
      ref={box}
      className={styles.box}
      onMouseOver={(e) => {
        if (!open(e.target, card ? 0 : OPEN_MS) && !(e.target as Element).closest(`.${styles.card}`)) close();
      }}
      onMouseLeave={() => close()}
      onFocus={(e) => {
        if (!open(e.target, 0) && !(e.target as Element).closest(`.${styles.card}`)) close(0);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || !(e.target as Element).closest(`.${styles.card}`)) close(0);
      }}
    >
      {children}
      {card && (
        <div
          className={styles.card}
          style={{ "--x": `${card.x}px`, top: card.y } as React.CSSProperties}
          onMouseEnter={() => clearTimeout(timer.current)}
        >
          <span className="smallcaps">{ENTRY_TYPE_LABEL[card.entry.type]}</span>
          <strong className={styles.name}>{card.entry.name}</strong>
          {card.entry.description && <p className={styles.description}>{card.entry.description}</p>}
          {shown === undefined ? (
            <span className={styles.loading} aria-hidden />
          ) : (
            shown && <p className={styles.preview}>{shown}</p>
          )}
          <Link href={`/stories/${storyId}/bible/${card.entry.id}`} className={styles.open}>
            Open Entry &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
