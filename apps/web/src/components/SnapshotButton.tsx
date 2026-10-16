"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { takeSnapshot } from "@/lib/actions/snapshots";
import { SNAPSHOT_KINDS, type SnapshotKind } from "@/lib/snapshots";
import { CameraIcon } from "./icons";
import { useLiveStatus } from "./LiveStatus";
import { useSnapshotCompare } from "./SnapshotCompare";
import { useStoryPanel } from "./StoryPanel";
import { useDismiss } from "./useDismiss";
import styles from "./SnapshotButton.module.css";

const NAME_MAX = 80;
const SAVED_MS = 2000;

/**
 * The toolbar's Snapshot button, for Co-hosts and up: a popover takes a Snapshot of the live Chapter or Entry,
 * optionally named. Grayed while apps/sync says there's nothing new to save.
 */
export function SnapshotButton({ kind, id }: { kind: SnapshotKind; id: string }) {
  const { snapshotChanged, snapshotEmpty } = useLiveStatus();
  const compare = useSnapshotCompare();
  const setHistory = useStoryPanel()?.setHistory;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const anchor = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const title =
    snapshotChanged === null
      ? "Connecting…"
      : !snapshotChanged
        ? snapshotEmpty
          ? "Nothing to save yet"
          : "No changes since the last Snapshot"
        : "Take a Snapshot";

  const close = useDismiss(open, () => setOpen(false), { root: anchor, returnTo: () => button.current });

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const submit = () =>
    startTransition(async () => {
      const failure = await takeSnapshot(kind, id, name);
      if (failure) {
        setError(failure);
        return;
      }
      close(true);
      setSaved(true);
      setHistory?.({ latestAt: new Date().toISOString() });
      await compare?.loadList();
    });

  return (
    <span className={styles.anchor} ref={anchor}>
      <span className={styles.saved} role="status">
        {saved && "Snapshot saved"}
      </span>
      <button
        ref={button}
        type="button"
        className="button button-ghost button-tiny with-icon"
        data-tip={title}
        disabled={!snapshotChanged}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) return close(false);
          setName("");
          setError(null);
          setOpen(true);
        }}
      >
        <CameraIcon />
        <span className="with-icon-label">Snapshot</span>
      </button>
      {open && (
        <form
          className={styles.popover}
          role="dialog"
          aria-labelledby={titleId}
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) submit();
          }}
        >
          <h3 id={titleId} className={styles.title}>
            Take a Snapshot
          </h3>
          <p className={styles.hint}>
            Saves this {SNAPSHOT_KINDS[kind].noun} as it is right now. Find it later in History.
          </p>
          <input
            className={styles.name}
            aria-label="Snapshot name"
            placeholder="Name (optional)"
            maxLength={NAME_MAX}
            autoComplete="off"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span className={styles.count} aria-hidden>
            {name.length} / {NAME_MAX}
          </span>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className="button button-ghost button-small" onClick={() => close(true)}>
              Cancel
            </button>
            <button className="button button-primary button-small" disabled={pending}>
              Take Snapshot
            </button>
          </div>
        </form>
      )}
    </span>
  );
}
