"use client";

import { useState, useTransition } from "react";
import { setStoryNotify } from "@/lib/actions/stories";
import type { StoryNotify } from "@/lib/notifications";
import styles from "../settings.module.css";

type Choice = { value: StoryNotify; label: string; hint: string };

const WRITER_CHOICES: Choice[] = [
  { value: "all", label: "All activity", hint: "Including new Chapters and new Writers." },
  { value: "mine", label: "Only about me", hint: "Replies, Writer Mentions, your role, and when the Story is Finished." },
];

const VIEWER_CHOICES: Choice[] = [
  { value: "all", label: "New Chapters", hint: "Each new Chapter, and when the Story is Finished." },
  { value: "mine", label: "Only about me", hint: "Your role, and when the Story is Finished." },
];

/** Which notifications this Story sends you. Saves on click; a failed save puts the old choice back. */
export function StoryNotifyChoice({
  storyId,
  selected,
  viewer,
}: {
  storyId: string;
  selected: StoryNotify;
  viewer: boolean;
}) {
  const [value, setValue] = useState(selected);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function choose(next: StoryNotify) {
    const previous = value;
    setValue(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const failed = await setStoryNotify(storyId, next);
      if (failed) setValue(previous);
      setError(failed);
      setSaved(!failed);
    });
  }

  return (
    <fieldset className={styles.choices}>
      <legend>
        <h3>
          Notifications{" "}
          {saved && (
            <span className={styles.saved} role="status">
              ✓ Saved
            </span>
          )}
        </h3>
      </legend>
      {(viewer ? VIEWER_CHOICES : WRITER_CHOICES).map((c) => (
        <label key={c.value} className={styles.choice}>
          <input
            type="radio"
            name="notify"
            value={c.value}
            checked={value === c.value}
            onChange={() => choose(c.value)}
          />
          <span>
            <strong>{c.label}</strong> <span className="muted">{c.hint}</span>
          </span>
        </label>
      ))}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </fieldset>
  );
}
