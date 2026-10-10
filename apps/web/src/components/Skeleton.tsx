import { Wordmark } from "./Wordmark";
import headerStyles from "./SiteHeader.module.css";

type Size = number | string;

/**
 * A placeholder bar for text or media that comes from data. With no height it stands in for one line of text:
 * font-sized, centred in the line height it inherits, so put it inside an element with that text's class.
 */
export function Bar({ width, height, round }: { width: Size; height?: Size; round?: boolean }) {
  return (
    <span
      className="skeleton"
      data-round={round || undefined}
      data-text={height === undefined || undefined}
      style={{ width, height }}
      aria-hidden
    />
  );
}

/** One line of placeholder text in `as`, styled by the page's own `className`. */
export function Line({ as: Tag = "div", className, width }: { as?: React.ElementType; className?: string; width: Size }) {
  return (
    <Tag className={className} aria-hidden>
      <Bar width={width} />
    </Tag>
  );
}

const PARAGRAPH = ["100%", "96%", "100%", "88%", "100%", "93%"];

/** A paragraph of `count` placeholder lines, the last one short, in `className`'s font. */
export function Lines({ count, className }: { count: number; className?: string }) {
  return (
    <div className={className} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} width={i === count - 1 ? "62%" : PARAGRAPH[i % PARAGRAPH.length]!} />
      ))}
    </div>
  );
}

/**
 * The wrapper every loading.tsx renders, so screen readers hear one "Loading…". It lays out as if absent, so the
 * skeleton's markup lands where the page's own would in the parent's flex or grid.
 */
export function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" style={{ display: "contents" }}>
      <span role="status" className="sr-only">
        Loading…
      </span>
      {children}
    </div>
  );
}

/** Shown while crossing between shells (Site ↔ Story, desk ↔ Reader), before the destination's own skeleton. */
export function PlainFallback() {
  return (
    <Loading>
      <header className={headerStyles.header}>
        <span className={headerStyles.wordmark}>
          <Wordmark />
        </span>
        <div className={headerStyles.end}>
          <Bar width={26} height={26} round />
        </div>
      </header>
      <main className="page">
        <Bar width="55%" height={28} />
        <Bar width="100%" height={16} />
        <Bar width="80%" height={16} />
      </main>
    </Loading>
  );
}
