import { Wordmark } from "./Wordmark";
import headerStyles from "./SiteHeader.module.css";

type Size = number | string;

/** A placeholder bar for text or media that comes from data. Size text bars to the line height they stand in for. */
export function Bar({ width, height, round }: { width: Size; height: Size; round?: boolean }) {
  return <span className="skeleton" data-round={round || undefined} style={{ width, height }} aria-hidden />;
}

/** The wrapper every loading.tsx renders, so screen readers hear one "Loading…". */
export function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true">
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
