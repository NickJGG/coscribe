import { authorColorCss } from "@/lib/profile-rules";
import styles from "./ContributionRibbon.module.css";

/** A Writer's share of a Story's text. `color` is null for a former Writer. */
export type RibbonSegment = { id: string; name: string; color: string | null; chars: number };

/**
 * Who wrote the Story, as a thin bar split by surviving characters. Segments keep the order given (join
 * order, never size) and carry no numbers, so it reads as a byline rather than a scoreboard. With `lit`, only
 * those Writers keep their color; `vertical` stands it on end as a spine filling its container's height.
 */
export function ContributionRibbon({
  segments,
  lit,
  vertical,
}: {
  segments: RibbonSegment[];
  lit?: ReadonlySet<string>;
  vertical?: boolean;
}) {
  const shown = segments.filter((s) => s.chars > 0);
  if (!shown.length) return null;
  const names = shown.map((s) => s.name).join(", ");

  return (
    <span
      className={styles.ribbon}
      data-vertical={vertical || undefined}
      role="img"
      aria-label={`Written by ${names}`}
      data-tip={names}
    >
      {shown.map((s) => (
        <span
          key={s.id}
          style={
            {
              flexGrow: s.chars,
              "--c": lit && !lit.has(s.id) ? "var(--rule)" : s.color ? authorColorCss(s.color) : undefined,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
