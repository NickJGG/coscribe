"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { IMPORTED_AUTHOR } from "@coscribe/editor";
import { relativeTime } from "@/lib/relative-time";
import { authorColorCss } from "@/lib/profile-rules";
import { paragraphShares, type AuthorRun } from "@/lib/contribution";
import { useMeasure } from "@/lib/use-measure";
import styles from "./LiveDocument.module.css";

/** A Story member whose text can carry an `author` mark. */
export type StoryAuthor = { id: string; name: string; color: string };

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Who an `author` mark's `userId` names, for a tooltip or legend. */
export function authorName(byId: ReadonlyMap<string, StoryAuthor>, userId: string): string {
  if (userId === IMPORTED_AUTHOR) return "Imported text";
  return byId.get(userId)?.name ?? "A former Writer";
}

type Tip = { text: string; x: number; y: number };

/** A paragraph's split margin bar, placed against the Authorship box. */
type Bar = { top: number; height: number; shares: AuthorRun[] };

const NO_BARS: Bar[] = [];

/**
 * "Show authors": tints each `author` run by its Author Color, puts a bar in the margin of each paragraph
 * split by each Writer's share of its characters, and hovering a run says who wrote it and when.
 */
export function Authorship({
  authors,
  show,
  bars: showBars = true,
  aside,
  children,
}: {
  authors: StoryAuthor[];
  show: boolean;
  bars?: boolean;
  /** Laid over the box beside the text, unclipped, like the bars. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const roots = useMemo(() => [text], []);
  const measure = useCallback(() => measureBars(box.current!, text.current!), []);
  const bars = useMeasure(roots, show && showBars ? measure : null, NO_BARS);
  const byId = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const tints = useMemo(
    () =>
      authors
        .filter((a) => HEX_COLOR.test(a.color))
        .map((a) => `span[data-author="${a.id}"]{--author-tint:${authorColorCss(a.color)}}`)
        .join("") + `span[data-author="${IMPORTED_AUTHOR}"]{--author-tint:var(--faint)}`,
    [authors]
  );

  function onMouseOver(event: React.MouseEvent<HTMLDivElement>) {
    const span = (event.target as Element).closest<HTMLElement>("span[data-author]");
    if (!span || !clip.current) return setTip(null);
    const name = authorName(byId, span.dataset.author!);
    const at = Number(span.dataset.at);
    const origin = clip.current.getBoundingClientRect();
    // A run can wrap across lines; anchor to the line under the pointer.
    const line =
      [...span.getClientRects()].find((r) => event.clientY >= r.top && event.clientY <= r.bottom) ??
      span.getBoundingClientRect();
    setTip({
      text: at ? `${name}, ${relativeTime(at)}` : name,
      x: event.clientX - origin.left,
      y: line.top - origin.top,
    });
  }

  function barColor(author: string) {
    if (author === IMPORTED_AUTHOR) return "var(--faint)";
    const color = byId.get(author)?.color;
    return color && HEX_COLOR.test(color) ? authorColorCss(color) : undefined;
  }

  return (
    <div
      ref={box}
      className={styles.authorship}
      data-show-authors={show || undefined}
      onMouseOver={show ? onMouseOver : undefined}
      onMouseLeave={() => setTip(null)}
    >
      {show && <style>{tints}</style>}
      {show && showBars && (
        <div className={styles.margin} aria-hidden>
          {bars.map((bar, i) => (
            <span key={i} className={styles.bar} style={{ top: bar.top, height: bar.height }}>
              {bar.shares.map((s) => (
                <span key={s.author} style={{ flexGrow: s.chars, "--c": barColor(s.author) } as React.CSSProperties} />
              ))}
            </span>
          ))}
        </div>
      )}
      {aside}
      {/* Caret labels and the tooltip can stick out past a phone's edge; the margin bars must not be cut off. */}
      <div ref={clip} className={styles.clip}>
        <div ref={text}>{children}</div>
        {show && tip && (
          <div className={styles.authorTip} role="tooltip" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Each paragraph's margin bar, measured from its rendered `span[data-author]` runs. Works the same over a
 * live editor and over static Reader markup.
 */
function measureBars(origin: HTMLElement, root: HTMLElement): Bar[] {
  const paragraphs = [...root.querySelectorAll("p")];
  if (!paragraphs.length) return [];
  const top = origin.getBoundingClientRect().top;
  // Trim each bar to the text rather than the full line boxes, as in the design.
  const inset = parseFloat(getComputedStyle(paragraphs[0]!).fontSize) * 0.45;

  return paragraphs.flatMap((p) => {
    const shares = paragraphShares(
      [...p.querySelectorAll<HTMLElement>("span[data-author]")].map((span) => ({
        author: span.dataset.author!,
        chars: authoredLength(span),
      }))
    );
    if (!shares.length) return [];
    const rect = p.getBoundingClientRect();
    return [
      {
        top: Math.round(rect.top - top + inset),
        height: Math.max(3, Math.round(rect.height - 2 * inset)),
        shares,
      },
    ];
  });
}

/** A run's own characters, leaving out the name label of any remote caret drawn inside it. */
function authoredLength(span: HTMLElement): number {
  let length = span.textContent.length;
  for (const label of span.querySelectorAll(".collaboration-carets__label")) length -= label.textContent.length;
  return length;
}
