"use client";

import { useState, useTransition } from "react";
import { setStoryColor } from "@/lib/actions/stories";
import { ColorSwatches } from "@/components/ColorSwatches";
import styles from "../settings.module.css";

/** Your Author Color in one Story. Saves the moment a swatch is picked; a failed save puts the old one back. */
export function StoryColorPicker({
  storyId,
  selected,
  taken,
  children,
}: {
  storyId: string;
  selected: string;
  taken: Map<string, string>;
  children?: React.ReactNode;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resets, setResets] = useState(0);
  const [, startTransition] = useTransition();

  function choose(color: string) {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const failed = await setStoryColor(storyId, color);
      if (failed) setResets((n) => n + 1);
      setError(failed);
      setSaved(!failed);
    });
  }

  return (
    <>
      <h3>
        Your color{" "}
        {saved && (
          <span className={styles.saved} role="status">
            ✓ Saved
          </span>
        )}
      </h3>
      {children}
      <div onChange={(e) => choose((e.target as HTMLInputElement).value)}>
        <ColorSwatches key={`${selected}-${resets}`} name="author_color" selected={selected} taken={taken} />
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}
