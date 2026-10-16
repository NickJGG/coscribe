"use client";

import { useOptimistic, useState, useTransition } from "react";
import { speakerKey } from "@coscribe/editor";
import { editEntry } from "@/lib/actions/entries";
import {
  DESCRIPTION_MAX,
  NAME_MAX,
  type EntryPatch,
  type EntryMentionEntry,
  type EntryVoice,
  type VoiceKind,
  type VoicePitch,
} from "@/lib/entries";
import type { ActionResult } from "@/lib/action-result";
import { castVoices } from "@/lib/narration/voices";
import { speak } from "@/lib/narration/speaker";
import { useNarration } from "./narration/NarrationProvider";
import { HeadphonesIcon } from "./icons";
import { InlineEdit } from "./InlineEdit";
import { Switch } from "./Switch";
import styles from "./EntryDetails.module.css";

/** An Entry's name, edited in place by Writers. */
export function EntryName({
  storyId,
  entry,
  editable,
  as,
  className,
}: {
  storyId: string;
  entry: EntryMentionEntry;
  editable: boolean;
  as: "h1" | "h2";
  className?: string;
}) {
  return (
    <InlineEdit
      as={as}
      className={className}
      value={entry.name}
      label="Name"
      maxLength={NAME_MAX}
      editable={editable}
      spellCheck={false}
      onSave={(name) => editEntry(storyId, entry.id, { name })}
    />
  );
}

/**
 * An Entry's description and Aliases, each edited in place by Writers, and on the Entry page its Link Entry
 * Mentions switch. Viewers see the same fields as plain text, without the Alias controls. A Character's Entry
 * page also shows Writers its Voice (`castable`), read-only once the Story is Finished.
 */
export function EntryDetails({
  storyId,
  entry,
  editable,
  castable = false,
  variant = "page",
}: {
  storyId: string;
  entry: EntryMentionEntry;
  editable: boolean;
  castable?: boolean;
  variant?: "page" | "card";
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [shown, show] = useOptimistic(entry, (e, patch: EntryPatch) => ({ ...e, ...patch }));
  const save = (patch: EntryPatch) => editEntry(storyId, entry.id, patch);

  function saveNow(patch: EntryPatch) {
    startTransition(async () => {
      show(patch);
      setError(await save(patch));
    });
  }

  return (
    <>
      <InlineEdit
        as="p"
        className={variant === "card" ? styles.cardDescription : styles.description}
        value={entry.description}
        label="Description"
        placeholder="Add a one-line description"
        maxLength={DESCRIPTION_MAX}
        editable={editable}
        onSave={(description) => save({ description })}
      />
      {editable ? (
        <div className={styles.aliasRow}>
          <Aliases aliases={entry.aliases} onSave={(aliases) => save({ aliases })} />
          {variant === "page" && (
            <Switch
              className={styles.linkSwitch}
              checked={shown.linkEntryMentions}
              onChange={(linkEntryMentions) => saveNow({ linkEntryMentions })}
            >
              Link Entry Mentions in the text
            </Switch>
          )}
        </div>
      ) : (
        entry.aliases.length > 0 && (
          <ul className={styles.aliases} aria-label="Aliases">
            {entry.aliases.map((a) => (
              <li key={a} className={styles.alias}>
                {a}
              </li>
            ))}
          </ul>
        )
      )}
      {castable && variant === "page" && entry.type === "character" && (
        <VoiceRow entry={entry} voice={shown.voice} editable={editable} onChange={(voice) => saveNow({ voice })} />
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}

const KINDS: [VoiceKind | null, string][] = [
  ["feminine", "Feminine"],
  ["masculine", "Masculine"],
  [null, "Any"],
];

const PITCHES: [VoicePitch, string][] = [
  [-1, "Lower"],
  [0, "Normal"],
  [1, "Higher"],
];

/** A Character's Voice: the kind of voice and pitch its dialogue is narrated in, and a sample to hear it. */
function VoiceRow({
  entry,
  voice,
  editable,
  onChange,
}: {
  entry: EntryMentionEntry;
  voice: EntryVoice;
  editable: boolean;
  onChange: (voice: EntryVoice) => void;
}) {
  const narration = useNarration();
  const unsupported = narration.support !== "ok";

  function hear() {
    if (unsupported) return;
    if (narration.status === "playing") narration.pause();
    const key = speakerKey({ entryId: entry.id });
    const cast = castVoices({
      speakers: [key],
      voices: narration.voices,
      narrator: narration.voice,
      cast: { [key]: voice },
    }).get(key);
    void speak(
      { block: -1, from: 0, to: 0, speak: `${entry.name}.`, pauseAfterMs: 0, kind: "sentence" },
      { voice: cast?.voice ?? null, rate: narration.rate, pitch: cast?.pitch }
    );
  }

  return (
    <div className={styles.voiceRow}>
      <span className={styles.voiceLabel}>Voice</span>
      <span className="segmented" role="group" aria-label="Voice">
        {KINDS.map(([kind, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={voice.kind === kind}
            disabled={!editable}
            onClick={() => onChange({ ...voice, kind })}
          >
            {label}
          </button>
        ))}
      </span>
      <span className="segmented" role="group" aria-label="Pitch">
        {PITCHES.map(([pitch, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={voice.pitch === pitch}
            disabled={!editable}
            onClick={() => onChange({ ...voice, pitch })}
          >
            {label}
          </button>
        ))}
      </span>
      <button
        type="button"
        className="button button-ghost button-tiny with-icon"
        aria-disabled={unsupported ? "true" : undefined}
        data-tip={narration.support === "none" ? "This browser can't read aloud" : undefined}
        onClick={hear}
      >
        <HeadphonesIcon />
        Hear it
      </button>
    </div>
  );
}

function Aliases({ aliases, onSave }: { aliases: string[]; onSave: (aliases: string[]) => Promise<ActionResult> }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit(next: string[], done?: () => void) {
    startTransition(async () => {
      const result = await onSave(next);
      setError(result);
      if (!result) done?.();
    });
  }

  return (
    <div className={styles.aliasBlock}>
      <ul className={styles.aliases} aria-label="Aliases">
        {aliases.map((a) => (
          <li key={a} className={styles.alias}>
            {a}
            <button
              type="button"
              className={styles.removeAlias}
              aria-label={`Remove Alias ${a}`}
              disabled={pending}
              onClick={() => commit(aliases.filter((x) => x !== a))}
            >
              &times;
            </button>
          </li>
        ))}
        <li>
          {adding ? (
            <input
              className={`input ${styles.aliasInput}`}
              spellCheck={false}
              aria-label="New Alias"
              placeholder="Another name"
              maxLength={NAME_MAX}
              disabled={pending}
              autoFocus
              onBlur={(e) => {
                if (!e.currentTarget.value.trim()) setAdding(false);
              }}
              onKeyDown={(e) => {
                const value = e.currentTarget.value.trim();
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (value) commit([...aliases, value], () => setAdding(false));
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setError(null);
                  setAdding(false);
                }
              }}
            />
          ) : (
            <button type="button" className={styles.addAlias} onClick={() => setAdding(true)}>
              + Add alias
            </button>
          )}
        </li>
      </ul>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
