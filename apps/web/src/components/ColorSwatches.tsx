import { AUTHOR_COLOR_NAMES, AUTHOR_COLORS, authorColorCss } from "@/lib/profile-rules";
import styles from "./ColorSwatches.module.css";

/** Radio buttons for the Author Color palette. `taken` maps colors someone else has to their username. */
export function ColorSwatches({
  name,
  selected,
  taken,
}: {
  name: string;
  selected: string;
  taken?: Map<string, string>;
}) {
  return (
    <div className={styles.swatches}>
      {AUTHOR_COLORS.map((color) => {
        const owner = taken?.get(color);
        return (
          <label
            key={color}
            className={styles.swatch}
            style={{ "--swatch": authorColorCss(color) } as React.CSSProperties}
            data-tip={owner ? `${AUTHOR_COLOR_NAMES[color]}, taken by ${owner}` : AUTHOR_COLOR_NAMES[color]}
          >
            <input
              type="radio"
              name={name}
              value={color}
              defaultChecked={color === selected}
              disabled={!!owner}
              required
            />
            <span className="sr-only">
              {AUTHOR_COLOR_NAMES[color]}
              {owner && `, taken by ${owner}`}
            </span>
          </label>
        );
      })}
    </div>
  );
}
