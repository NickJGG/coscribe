"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { chapterExtensions } from "@coscribe/editor";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/relative-time";
import { nameSnapshot, previewSnapshot, restoreSnapshot } from "@/lib/actions/snapshots";
import { Authorship, type StoryAuthor } from "./LiveDocument";
import { Panel, usePanelOpen, useStoryPanel } from "./StoryPanel";
import liveStyles from "./LiveDocument.module.css";
import styles from "./SnapshotHistory.module.css";

type Snapshot = { id: string; taken_at: string; name: string | null };
type Preview = { id: string; content?: JSONContent; error?: string };

const LIMIT = 100;
/** Also how often the footer's "Snapshot saved N minutes ago" is brought up to date. */
const POLL_MS = 60_000;
const takenAt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/**
 * A Chapter's Snapshot timeline in the Story's right panel, for Co-hosts and up: preview each with author
 * tint, Restore one, or copy text out of it to paste into the live Chapter (author marks travel with
 * it). Hosts name them. While mounted it also tells the desk footer when the latest Snapshot was taken.
 */
export function SnapshotHistory({
  chapterId,
  chapterTitle,
  authors,
  canRestore,
  canName,
}: {
  chapterId: string;
  chapterTitle: string;
  authors: StoryAuthor[];
  canRestore: boolean;
  canName: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const setHistory = useStoryPanel()?.setHistory;
  const close = useStoryPanel()?.close;
  const open = usePanelOpen("history");
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const selected = useRef<string | null>(null);

  const loadLatest = useCallback(async () => {
    const { data } = await supabase
      .from("chapter_snapshots")
      .select("taken_at")
      .eq("chapter_id", chapterId)
      .order("taken_at", { ascending: false })
      .limit(1);
    // A fresh object each time, so the footer's relative time re-renders even when nothing new was taken.
    if (data) setHistory?.({ latestAt: data[0]?.taken_at ?? null });
  }, [supabase, chapterId, setHistory]);

  const fetchList = useCallback(
    () =>
      supabase
        .from("chapter_snapshots")
        .select("id, taken_at, name")
        .eq("chapter_id", chapterId)
        .order("taken_at", { ascending: false })
        .limit(LIMIT),
    [supabase, chapterId]
  );

  const showList = useCallback(
    ({ data, error }: Awaited<ReturnType<typeof fetchList>>) => {
      setListError(error ? "Couldn't load the history." : null);
      if (!data) return;
      setSnapshots(data);
      setHistory?.({ latestAt: data[0]?.taken_at ?? null });
    },
    [setHistory]
  );

  const loadList = useCallback(async () => showList(await fetchList()), [fetchList, showList]);

  useEffect(() => {
    void loadLatest();
    const timer = setInterval(() => void loadLatest(), POLL_MS);
    return () => {
      clearInterval(timer);
      setHistory?.(null);
      close?.("history");
    };
  }, [loadLatest, setHistory, close]);

  useEffect(() => {
    if (open) void fetchList().then(showList);
  }, [open, fetchList, showList]);

  async function select(id: string) {
    selected.current = id;
    setPreview({ id });
    const result = await previewSnapshot(id);
    if (selected.current === id) setPreview({ id, ...result });
  }

  function back() {
    selected.current = null;
    setPreview(null);
  }

  const current = snapshots?.find((s) => s.id === preview?.id);

  return (
    <Panel name="history" title={`History · ${chapterTitle}`}>
      {preview ? (
        <section className={styles.preview} aria-label="Snapshot preview">
          <button type="button" className={styles.back} onClick={back}>
            &larr; All Snapshots
          </button>
          {current && (
            <p className={styles.previewHead}>
              {current.name && <span className={styles.name}>&ldquo;{current.name}&rdquo;</span>}
              <span className={styles.when}>{takenAt.format(new Date(current.taken_at))}</span>
            </p>
          )}
          {!preview.content && !preview.error && <p className="muted">Loading…</p>}
          {preview.error && <p className={styles.error}>{preview.error}</p>}
          {preview.content && current && (
            <SnapshotView
              key={preview.id}
              snapshot={current}
              content={preview.content}
              authors={authors}
              canRestore={canRestore}
              canName={canName}
              onChanged={loadList}
            />
          )}
        </section>
      ) : (
        <nav className={styles.timeline} aria-label="Snapshots">
          {listError && <p className={styles.error}>{listError}</p>}
          {snapshots?.length === 0 && (
            <p className="muted">
              No Snapshots yet. One is taken after about 10 minutes of writing, and when everyone leaves the
              Chapter.
            </p>
          )}
          <ol className={styles.list}>
            {snapshots?.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={styles.item}
                  data-named={s.name ? "" : undefined}
                  onClick={() => void select(s.id)}
                >
                  {s.name && <span className={styles.name}>&ldquo;{s.name}&rdquo;</span>}
                  <span className={styles.when}>{relativeTime(Date.parse(s.taken_at))}</span>
                  <span className={styles.sub}>{takenAt.format(new Date(s.taken_at))}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </Panel>
  );
}

function SnapshotView({
  snapshot,
  content,
  authors,
  canRestore,
  canName,
  onChanged,
}: {
  snapshot: Snapshot;
  content: JSONContent;
  authors: StoryAuthor[];
  canRestore: boolean;
  canName: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: chapterExtensions,
    content,
    editorProps: { attributes: { class: `${liveStyles.prose} ${styles.prose}`, "aria-label": "Snapshot text" } },
  });

  async function run(task: () => Promise<{ text: string; error?: boolean } | null>) {
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await task());
    } finally {
      setBusy(false);
    }
  }

  const restore = () =>
    run(async () => {
      const error = await restoreSnapshot(snapshot.id);
      if (error) return { text: error, error: true };
      await onChanged();
      return { text: "Restored. The text it replaced was saved as a Snapshot." };
    });

  // Serialized like a ProseMirror copy, so pasting into the Chapter keeps every `author` mark.
  const copy = () =>
    run(async () => {
      if (!editor) return null;
      const { state, view } = editor;
      const slice = state.selection.empty ? state.doc.slice(0, state.doc.content.size) : state.selection.content();
      const { dom, text } = view.serializeForClipboard(slice);
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([dom.innerHTML], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } catch {
        return { text: "Couldn't copy. Select the text and press Ctrl+C instead.", error: true };
      }
      return { text: `Copied ${state.selection.empty ? "the whole Snapshot" : "the selection"}. Paste it into the Chapter.` };
    });

  const rename = (formData: FormData) =>
    run(async () => {
      const error = await nameSnapshot(snapshot.id, String(formData.get("name") ?? ""));
      if (error) return { text: error, error: true };
      await onChanged();
      return { text: "Saved." };
    });

  return (
    <div className={styles.view}>
      <div className={styles.actions}>
        {canRestore && (
          <button
            type="button"
            className="button button-small button-primary"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Restore this Snapshot? The Chapter's current text is saved as a Snapshot first.")) {
                void restore();
              }
            }}
          >
            Restore
          </button>
        )}
        <button
          type="button"
          className="button button-small"
          disabled={busy || !editor}
          onClick={() => void copy()}
          title="Copies the selected text, or the whole Snapshot if nothing is selected"
        >
          Copy from this Snapshot
        </button>
      </div>

      {canName && (
        <form action={rename} className={styles.nameForm}>
          <label className="sr-only" htmlFor="snapshot-name">
            Snapshot name
          </label>
          <input
            id="snapshot-name"
            name="name"
            className="input"
            maxLength={80}
            defaultValue={snapshot.name ?? ""}
            placeholder="Name this Snapshot"
          />
          <button className="button button-small" disabled={busy}>
            Save name
          </button>
        </form>
      )}

      {notice && (
        <p role={notice.error ? "alert" : "status"} className={notice.error ? styles.error : "muted"}>
          {notice.text}
        </p>
      )}

      <Authorship authors={authors} show>
        <EditorContent editor={editor} />
      </Authorship>
    </div>
  );
}
