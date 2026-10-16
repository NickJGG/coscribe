"use client";

import { useCallback, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/relative-time";
import { SNAPSHOT_KINDS, type SnapshotKind } from "@/lib/snapshots";
import { usePhone, useSnapshotCompare } from "./SnapshotCompare";
import { Panel, useStoryPanel } from "./StoryPanel";
import styles from "./SnapshotHistory.module.css";

/** Also how often the footer's "Snapshot saved N minutes ago" is brought up to date. */
const POLL_MS = 60_000;
const takenAt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/**
 * A Chapter's or Entry's Snapshot timeline in the Story's right panel, for Co-hosts and up, inside a
 * SnapshotCompareProvider. Clicking one compares it with the current text in the main area (closing the
 * panel on a phone), where it can be Restored, copied from or named. While mounted it also tells the desk
 * footer when the latest Snapshot was taken.
 */
export function SnapshotHistory({ kind, id, title }: { kind: SnapshotKind; id: string; title: string }) {
  const supabase = useMemo(() => createClient(), []);
  const setHistory = useStoryPanel()?.setHistory;
  const close = useStoryPanel()?.close;
  const { snapshots, listError, compare, openCompare } = useSnapshotCompare()!;
  const phone = usePhone();

  const loadLatest = useCallback(async () => {
    const { data } = await supabase
      .from(SNAPSHOT_KINDS[kind].table)
      .select("taken_at")
      .filter(SNAPSHOT_KINDS[kind].column, "eq", id)
      .order("taken_at", { ascending: false })
      .limit(1);
    // A fresh object each time, so the footer's relative time re-renders even when nothing new was taken.
    if (data) setHistory?.({ latestAt: data[0]?.taken_at ?? null });
  }, [supabase, kind, id, setHistory]);

  useEffect(() => {
    void loadLatest();
    const timer = setInterval(() => void loadLatest(), POLL_MS);
    return () => {
      clearInterval(timer);
      setHistory?.(null);
      close?.("history");
    };
  }, [loadLatest, setHistory, close]);

  return (
    <Panel name="history" title={`History · ${title}`}>
      <nav className={styles.timeline} aria-label="Snapshots">
        {listError && <p className={styles.error}>{listError}</p>}
        {snapshots?.length === 0 && (
          <p className="muted">
            No Snapshots yet. One is taken after about 10 minutes of writing, and when everyone leaves the{" "}
            {SNAPSHOT_KINDS[kind].noun}, or take one any time with Snapshot in the toolbar.
          </p>
        )}
        <ol className={styles.list}>
          {snapshots?.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={styles.item}
                data-named={s.name ? "" : undefined}
                aria-current={s.id === compare || undefined}
                onClick={() => {
                  openCompare(s.id);
                  if (phone) close?.("history");
                }}
              >
                {s.name && <span className={styles.name}>&ldquo;{s.name}&rdquo;</span>}
                <span className={styles.when}>{relativeTime(Date.parse(s.taken_at))}</span>
                <span className={styles.sub}>{takenAt.format(new Date(s.taken_at))}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </Panel>
  );
}
