"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/core";
import { featureError, sliceChapter, type TextPoint } from "@coscribe/editor";
import { featurePassage } from "@/lib/actions/passages";
import styles from "./FeaturePassage.module.css";

type Offer = {
  from: TextPoint;
  to: TextPoint;
  error: string | null;
  /** The selection's box, relative to the wrapper. */
  top: number;
  bottom: number;
  center: number;
};

/**
 * Around a Finished Chapter's `ProseView positions` in the Reader View, for its Writers: selecting text
 * floats a "Feature on my profile" button over it, disabled with the reason when the selection can't be
 * featured (see `featureError`).
 */
export function FeaturePassage({
  storyId,
  chapterId,
  userId,
  username,
  content,
  children,
}: {
  storyId: string;
  chapterId: string;
  userId: string;
  username: string;
  content: JSONContent;
  children: React.ReactNode;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const prose = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [result, setResult] = useState<{ error: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onSelectionChange = () => {
      setResult(null);
      setOffer(readSelection(wrapper.current!, prose.current!, content, userId));
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [content, userId]);

  // Centered over the selection, but kept inside the text column.
  useLayoutEffect(() => {
    if (!offer || !pop.current) return;
    const width = pop.current.offsetWidth;
    const max = wrapper.current!.clientWidth - width;
    pop.current.style.left = `${Math.max(0, Math.min(offer.center - width / 2, max))}px`;
  }, [offer, result, pending]);

  function feature() {
    if (!offer || offer.error || pending) return;
    const { from, to } = offer;
    startTransition(async () => {
      setResult({ error: await featurePassage(storyId, chapterId, from, to) });
    });
  }

  return (
    <div ref={wrapper} className={styles.wrapper}>
      <div ref={prose}>{children}</div>
      {offer && (
        <div
          ref={pop}
          className={styles.pop}
          style={{ "--above": `${offer.top}px`, "--below": `${offer.bottom}px` } as React.CSSProperties}
          onMouseDown={(e) => e.preventDefault()}
        >
          {result && !result.error ? (
            <span className={styles.done}>
              Featured. <Link href={`/u/${username}`}>View your profile &rarr;</Link>
            </span>
          ) : (
            <>
              <button
                type="button"
                className={`button button-small${offer.error ? "" : " button-primary"}`}
                disabled={!!offer.error || pending}
                onClick={feature}
              >
                {pending ? "Featuring…" : "Feature on my profile"}
              </button>
              {(offer.error ?? result?.error) && (
                <span className={styles.why} role={result?.error ? "alert" : undefined}>
                  {offer.error ?? result?.error}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The current selection's part of the prose, as points into `content`, or null if it holds no text there. */
function readSelection(wrapper: HTMLElement, prose: HTMLElement, content: JSONContent, userId: string): Offer | null {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!range.intersectsNode(prose)) return null;

  const whole = document.createRange();
  whole.selectNodeContents(prose);
  const clamped = range.cloneRange();
  if (whole.comparePoint(range.startContainer, range.startOffset) < 0) clamped.setStart(prose, 0);
  if (whole.comparePoint(range.endContainer, range.endOffset) > 0) clamped.setEnd(prose, prose.childNodes.length);

  const from = pointAt(prose, clamped.startContainer, clamped.startOffset);
  const to = pointAt(prose, clamped.endContainer, clamped.endOffset);
  if (!from || !to) return null;
  const slice = sliceChapter(content, from, to);
  if (!slice.content?.length) return null;

  const origin = wrapper.getBoundingClientRect();
  const box = clamped.getBoundingClientRect();
  return {
    from,
    to,
    error: featureError(slice, userId),
    top: box.top - origin.top,
    bottom: box.bottom - origin.top,
    center: (box.left + box.right) / 2 - origin.left,
  };
}

/** A DOM boundary inside `prose` as a block index and an offset into that block's text. */
function pointAt(prose: HTMLElement, node: Node, offset: number): TextPoint | null {
  if (node === prose) {
    const blocks = [...prose.children] as HTMLElement[];
    if (!blocks.length) return null;
    const next = blocks[offset];
    if (next) return { block: Number(next.dataset.block), offset: 0 };
    const last = blocks.at(-1)!;
    return { block: Number(last.dataset.block), offset: last.textContent.length };
  }
  const element = node instanceof Element ? node : node.parentElement;
  const block = element?.closest<HTMLElement>("[data-block]");
  if (!block || !prose.contains(block)) return null;
  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(node, offset);
  return { block: Number(block.dataset.block), offset: before.toString().length };
}
