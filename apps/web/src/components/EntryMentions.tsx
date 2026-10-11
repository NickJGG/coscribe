"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findEntryMentions } from "@coscribe/editor";
import { ENTRY_TYPE_LABEL, type EntryMentionEntry } from "@/lib/entries";
import { getEntryPreview } from "@/lib/actions/entries";
import { touchedTextblocks } from "@/lib/touched-textblocks";
import { PinButton, PinError } from "./PinnedEntries";
import styles from "./EntryMentions.module.css";

/** Which Entries to underline, and whether Entry Mentions take keyboard focus (only when the text isn't editable). */
export type EntryMentionConfig = { entries: EntryMentionEntry[]; focusable: boolean };

type EntryMentionState = EntryMentionConfig & { set: DecorationSet };

export const entryMentionKey = new PluginKey<EntryMentionState>("entryMentions");

/**
 * Underlines Entry Mentions with decorations, so the document schema (and apps/sync) never sees them, and turns
 * spellcheck off over every name and Alias, linked or not. Edits re-match only the text blocks they touch;
 * a transaction with an `EntryMentionConfig` under `entryMentionKey` re-matches everything.
 */
export const EntryMentions = Extension.create<EntryMentionConfig>({
  name: "entryMentions",

  addOptions() {
    return { entries: [], focusable: false };
  },

  addProseMirrorPlugins() {
    const initial: EntryMentionConfig = { entries: this.options.entries, focusable: this.options.focusable };
    return [
      new Plugin<EntryMentionState>({
        key: entryMentionKey,
        state: {
          init: (_, state) => ({ ...initial, set: decorateAll(state.doc, initial) }),
          apply(tr, prev) {
            const config = tr.getMeta(entryMentionKey) as EntryMentionConfig | undefined;
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
          decorations: (state) => entryMentionKey.getState(state)?.set,
        },
      }),
    ];
  },
});

function decorateAll(doc: ProseMirrorNode, config: EntryMentionConfig): DecorationSet {
  if (!config.entries.length) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    decorations.push(...decorateBlock(node, pos, config));
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function decorateBlock(node: ProseMirrorNode, pos: number, { entries, focusable }: EntryMentionConfig): Decoration[] {
  if (!entries.length) return [];
  return findEntryMentions(node.textContent, entries).map((m) =>
    Decoration.inline(
      pos + 1 + m.from,
      pos + 1 + m.to,
      m.linked
        ? { class: styles.entryMention, "data-entry-mention": m.entryId, spellcheck: "false", ...(focusable && { tabindex: "0" }) }
        : { spellcheck: "false" }
    )
  );
}

type Card = { entry: EntryMentionEntry; x: number; y: number };

const OPEN_MS = 300;
const CLOSE_MS = 200;

/**
 * Hovering or focusing an Entry Mention inside `children` shows a read-only card for its Entry. The body's
 * opening lines load on first open and are kept for the rest of the visit.
 */
export function EntryMentionCards({
  storyId,
  entries,
  children,
}: {
  storyId: string;
  entries: EntryMentionEntry[];
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
    const entryMention = (target as Element).closest<HTMLElement>("[data-entry-mention]");
    if (!entryMention || !box.current) return false;
    const entry = entries.find((e) => e.id === entryMention.dataset.entryMention);
    if (!entry) return false;
    const origin = box.current.getBoundingClientRect();
    const rect = entryMention.getClientRects()[0] ?? entryMention.getBoundingClientRect();
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
          <div className={styles.actions}>
            <Link href={`/stories/${storyId}/bible/${card.entry.id}`} className={styles.open}>
              Open Entry &rarr;
            </Link>
            <PinButton
              entryId={card.entry.id}
              entryName={card.entry.name}
              className={`button button-ghost button-tiny with-icon ${styles.pin}`}
            />
          </div>
          <PinError entryId={card.entry.id} className={styles.error} />
        </div>
      )}
    </div>
  );
}
