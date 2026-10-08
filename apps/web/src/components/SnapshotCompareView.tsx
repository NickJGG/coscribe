"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import type { Transaction } from "@tiptap/pm/state";
import { DOMSerializer, Node as PMNode } from "@tiptap/pm/model";
import {
  chapterSchema,
  diffChapters,
  foldRows,
  type ChapterDiff,
  type DiffBlock,
  type DiffRow,
  type DiffSegment,
  type Fold,
  type FoldItem,
} from "@coscribe/editor";
import { nameSnapshot, previewSnapshot, restoreSnapshot, type SnapshotPreview } from "@/lib/actions/snapshots";
import { authorColorCss } from "@/lib/profile-rules";
import { DeskToolbar } from "./DeskToolbar";
import { Authorship, type StoryAuthor } from "./LiveDocument";
import { Text } from "./ProseView";
import { usePhone, useSnapshotCompare, type Snapshot } from "./SnapshotCompare";
import { usePanelOpen, useStoryPanel } from "./StoryPanel";
import { Switch } from "./Switch";
import liveStyles from "./LiveDocument.module.css";
import styles from "./SnapshotCompare.module.css";

type Side = { kind: "current" } | { kind: "snapshot"; snapshot: Snapshot };
type Frozen = { json: JSONContent; at: number };
type Notice = { text: string; error?: boolean };

const takenAt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const timeOnly = new Intl.DateTimeFormat("en", { timeStyle: "short" });
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
/** How long after a Restore the live Chapter's changes count as the Restore landing, not as new writing. */
const RESTORE_MS = 5000;
const FLASH_MS = 1600;
const NO_FOLDS = new Set<number>();

function label(side: Side) {
  if (side.kind === "current") return "the current text";
  const { name, taken_at } = side.snapshot;
  return name ? `“${name}”` : takenAt.format(new Date(taken_at));
}

/** Older on the left; the current text is always the newest. */
function ordered(a: Side, b: Side): [Side, Side] {
  return a.kind === "snapshot" && b.kind === "snapshot" && b.snapshot.taken_at < a.snapshot.taken_at ? [b, a] : [a, b];
}

function plural(n: number, word: string) {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

function option(s: Snapshot) {
  return (
    <option key={s.id} value={s.id}>
      {s.name ? `“${s.name}” · ` : ""}
      {takenAt.format(new Date(s.taken_at))}
    </option>
  );
}

/** The rows on show: with `changesOnly`, `rows` folded down to its changes, less the folds opened. */
function shownItems(rows: DiffRow[], changesOnly: boolean, opened: Set<number>): FoldItem[] {
  if (!changesOnly) return rows.map((_, row) => ({ kind: "row", row }));
  return foldRows(rows).flatMap((item): FoldItem[] =>
    item.kind === "fold" && opened.has(item.from)
      ? Array.from({ length: item.to - item.from }, (_, n) => ({ kind: "row", row: item.from + n }))
      : [item]
  );
}

/**
 * The Snapshot comparison open over the Chapter, in place of the hidden live document: two aligned
 * columns, older on the left, with removals struck through and additions tinted by their writer (on a
 * phone, one column with both inline). By default only the changes show, with a row of context around
 * each and the rest folded. The current text is frozen when the comparison opens; later edits only raise
 * a notice to refresh it.
 */
export function SnapshotCompareView({
  authors,
  canRestore,
  canName,
}: {
  authors: StoryAuthor[];
  canRestore: boolean;
  canName: boolean;
}) {
  const compare = useSnapshotCompare();
  if (!compare?.compare) return null;
  return <Comparison authors={authors} canRestore={canRestore} canName={canName} />;
}

function Comparison({
  authors,
  canRestore,
  canName,
}: {
  authors: StoryAuthor[];
  canRestore: boolean;
  canName: boolean;
}) {
  const { editor, snapshots, listError, loadList, compare, to, openCompare, setTo, exit } = useSnapshotCompare()!;
  const panelOpen = usePanelOpen("history");
  const showPanel = useStoryPanel()?.show;
  const phone = usePhone();
  const section = useRef<HTMLElement>(null);
  const [changesOnly, setChangesOnly] = useState(true);
  const [opened, setOpened] = useState<{ pair: string; folds: Set<number> } | null>(null);
  const [stepped, setStepped] = useState<{ diff: ChapterDiff; at: number } | null>(null);
  const [contents, setContents] = useState<Record<string, SnapshotPreview>>({});
  const requested = useRef(new Set<string>());
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  const [stale, setStale] = useState(false);
  const [restoredPair, setRestoredPair] = useState<string | null>(null);
  const restoring = useRef(0);
  const pair = `${compare}:${to}`;

  const freeze = useCallback(() => {
    if (!editor) return;
    setFrozen({ json: editor.getJSON(), at: Date.now() });
    setStale(false);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    // The live editor appears after the Chapter syncs; its text is frozen once, when it first can be.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrozen((frozen) => frozen ?? { json: editor.getJSON(), at: Date.now() });
    const onUpdate = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.docChanged) return;
      if (Date.now() < restoring.current) freeze();
      else setStale(true);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, freeze]);

  useEffect(() => {
    for (const id of [compare, to]) {
      if (!id || requested.current.has(id)) continue;
      requested.current.add(id);
      void previewSnapshot(id).then((result) => setContents((c) => ({ ...c, [id]: result })));
    }
  }, [compare, to]);

  // A Snapshot that isn't in the list (deleted, another Chapter's, a bad link) quietly isn't compared.
  useEffect(() => {
    if (!snapshots) return;
    if (!snapshots.some((s) => s.id === compare)) exit();
    else if (to && !snapshots.some((s) => s.id === to)) setTo(null);
  }, [snapshots, compare, to, exit, setTo]);

  const from = snapshots?.find((s) => s.id === compare);
  const other = to ? snapshots?.find((s) => s.id === to) : null;
  const sides =
    from && other !== undefined
      ? ordered({ kind: "snapshot", snapshot: from }, other ? { kind: "snapshot", snapshot: other } : { kind: "current" })
      : null;

  const jsonOf = (side: Side) => (side.kind === "current" ? frozen?.json : contents[side.snapshot.id]?.content);
  const leftJson = sides && jsonOf(sides[0]);
  const rightJson = sides && jsonOf(sides[1]);
  const diff = useMemo(
    () => (leftJson && rightJson ? diffChapters(leftJson, rightJson) : null),
    [leftJson, rightJson]
  );
  const errors = [compare, to].flatMap((id) => (id && contents[id]?.error ? [contents[id].error] : []));
  const showsCurrent = sides?.some((s) => s.kind === "current") ?? false;
  const same = diff ? diff.additions + diff.removals === 0 : false;

  const openFolds = opened?.pair === pair ? opened.folds : null;
  const items = useMemo(
    () => (diff ? shownItems(diff.rows, changesOnly, openFolds ?? NO_FOLDS) : []),
    [diff, changesOnly, openFolds]
  );
  const openFold = (from: number) => setOpened({ pair, folds: new Set(openFolds).add(from) });

  const stops = useMemo(
    () => diff?.rows.flatMap((row, r) => (row.kind === "same" ? [] : [r])) ?? [],
    [diff]
  );
  const at = stepped && stepped.diff === diff ? stepped.at : null;

  /** Moves to the next or previous change, wrapping around, and flashes it. Changes are never folded. */
  const step = (dir: 1 | -1) => {
    if (!diff || !stops.length) return;
    const next = at === null ? (dir > 0 ? 0 : stops.length - 1) : (at + dir + stops.length) % stops.length;
    setStepped({ diff, at: next });
    const cells = [...(section.current?.querySelectorAll<HTMLElement>(`[data-row="${stops[next]}"]`) ?? [])];
    cells[0]?.scrollIntoView({ block: "center" });
    for (const cell of cells) cell.setAttribute("data-flash", "");
    setTimeout(() => cells.forEach((cell) => cell.removeAttribute("data-flash")), FLASH_MS);
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== "g" || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    e.preventDefault();
    step(e.shiftKey ? -1 : 1);
  });
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const restore = async (snapshot: Snapshot): Promise<Notice | null> => {
    restoring.current = Infinity;
    const error = await restoreSnapshot(snapshot.id);
    if (error) {
      restoring.current = 0;
      return { text: error, error: true };
    }
    restoring.current = Date.now() + RESTORE_MS;
    freeze();
    setRestoredPair(pair);
    await loadList();
    return null;
  };

  /** The other side's picker; on a phone, where the panel is closed, the compared Snapshot's too. */
  const picker = (side: Side) => {
    if (!snapshots) return null;
    if (side.kind === "current" || side.snapshot.id === to) {
      return (
        <select
          className={styles.picker}
          aria-label="Compare with"
          value={to ?? ""}
          onChange={(e) => setTo(e.target.value || null)}
        >
          <option value="">Current text</option>
          {snapshots.filter((s) => s.id !== compare).map(option)}
        </select>
      );
    }
    if (!phone) return null;
    return (
      <select
        className={styles.picker}
        aria-label="Snapshot"
        value={compare ?? ""}
        onChange={(e) => openCompare(e.target.value)}
      >
        {snapshots.filter((s) => s.id !== to).map(option)}
      </select>
    );
  };

  /** A side's heading, with its Snapshot's actions; Copy reads the selection in `columnRef`, if given. */
  const heading = (side: Side, column: number, columnRef: React.RefObject<HTMLDivElement | null> | null) => (
    <Heading side={side} frozenAt={frozen?.at ?? null} picker={picker(side)}>
      {side.kind === "snapshot" && (
        <SnapshotActions
          key={side.snapshot.id}
          snapshot={side.snapshot}
          json={(column ? rightJson : leftJson)!}
          column={columnRef}
          canRestore={canRestore}
          canName={canName}
          replacesOther={!showsCurrent}
          onRestore={restore}
          onRenamed={loadList}
        />
      )}
    </Heading>
  );

  return (
    <section
      ref={section}
      className={styles.compare}
      data-compare=""
      data-panel-open={panelOpen || undefined}
      aria-label="Snapshot comparison"
    >
      <DeskToolbar.Fill>
        <div className={liveStyles.toolRow}>
          {diff && (
            <Summary diff={diff} authors={authors}>
              {!same && (
                <>
                  <Stepper at={at} count={stops.length} onStep={step} />
                  <Switch checked={changesOnly} onChange={setChangesOnly}>
                    Changes only
                  </Switch>
                </>
              )}
            </Summary>
          )}
        </div>
      </DeskToolbar.Fill>

      <div className={styles.banner}>
        <p className={styles.comparing}>
          {sides ? (
            <>
              Comparing <strong>{label(sides[0])}</strong> with <strong>{label(sides[1])}</strong>
            </>
          ) : (
            "Comparing Snapshots"
          )}
        </p>
        {phone && (
          <button type="button" className="button button-small" onClick={() => showPanel?.("history")}>
            Snapshots
          </button>
        )}
        <button type="button" className="button button-small" onClick={exit}>
          {phone ? "Back" : "Back to live Chapter"}
        </button>
        {stale && showsCurrent && (
          <p className={styles.notice} role="status">
            The Chapter has changed since you opened this. &middot;{" "}
            <button type="button" className={styles.link} onClick={freeze}>
              Refresh
            </button>
          </p>
        )}
        {restoredPair === pair && (
          <p className={styles.notice} role="status">
            Restored. The text it replaced was saved as a Snapshot.
          </p>
        )}
      </div>

      {listError && <p className={styles.error}>{listError}</p>}
      {errors.map((error) => (
        <p key={error} className={styles.error} role="alert">
          {error}
        </p>
      ))}

      {sides && diff ? (
        <Authorship authors={authors} show bars={false}>
          {phone ? (
            <>
              <div className={styles.heads}>
                {sides.map((side, column) => (
                  <div key={column} className={styles.side}>
                    <span className={styles.sideLabel}>{column ? "To" : "From"}</span>
                    {heading(side, column, null)}
                  </div>
                ))}
              </div>
              <div className={`${liveStyles.prose} ${styles.body} ${styles.inline}`} data-compare="">
                {same ? (
                  <NoDifferences />
                ) : (
                  items.map((item) =>
                    item.kind === "fold" ? (
                      <FoldButton key={`fold${item.from}`} fold={item} onOpen={openFold} />
                    ) : (
                      <InlineRow
                        key={item.row}
                        r={item.row}
                        row={diff.rows[item.row]!}
                        diff={diff}
                        faded={changesOnly}
                      />
                    )
                  )
                )}
              </div>
            </>
          ) : (
            <div className={`${liveStyles.prose} ${styles.body} ${styles.grid}`} data-compare="">
              {sides.map((side, column) => (
                <Column
                  key={column}
                  column={column}
                  side={side}
                  json={(column ? rightJson : leftJson)!}
                  blocks={column ? diff.right : diff.left}
                  rows={diff.rows}
                  items={same ? [] : items}
                  faded={changesOnly}
                  heading={(columnRef) => heading(side, column, columnRef)}
                />
              ))}
              {same ? (
                <NoDifferences />
              ) : (
                items.map(
                  (item, i) =>
                    item.kind === "fold" && (
                      <FoldButton key={`fold${item.from}`} fold={item} onOpen={openFold} gridRow={i + 2} />
                    )
                )
              )}
            </div>
          )}
        </Authorship>
      ) : (
        !errors.length && !listError && <p className="muted">Loading…</p>
      )}
    </section>
  );
}

/** "+N additions · −N removals", then `children`, then who the additions are by. */
function Summary({
  diff,
  authors,
  children,
}: {
  diff: ChapterDiff;
  authors: StoryAuthor[];
  children?: React.ReactNode;
}) {
  const writers = useMemo(() => {
    const ids = new Set<string>();
    for (const block of diff.right) {
      for (const segment of block.segments) {
        if (segment.op !== "ins") continue;
        for (const mark of segment.marks ?? []) if (mark.type === "author") ids.add(String(mark.attrs?.userId));
      }
    }
    const byId = new Map(authors.map((a) => [a.id, a]));
    return [...ids].map((id) => byId.get(id) ?? { id, name: "A former Writer", color: "" });
  }, [diff, authors]);

  if (!diff.additions && !diff.removals) return <span className={styles.counts}>No differences</span>;

  return (
    <>
      <span className={styles.counts}>
        +{plural(diff.additions, "addition")} &middot; &minus;{plural(diff.removals, "removal")}
      </span>
      {children}
      <span className={styles.legend}>
        {writers.length > 0 && (
          <span className={styles.legendItem}>
            Added by
            {writers.map((w) => (
              <span key={w.id} className={styles.legendItem}>
                <span
                  className={styles.swatch}
                  style={{ "--c": HEX_COLOR.test(w.color) ? authorColorCss(w.color) : undefined } as React.CSSProperties}
                />
                {w.name}
              </span>
            ))}
          </span>
        )}
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-removed="" />
          Removed
        </span>
      </span>
    </>
  );
}

/** "Change X of N ‹ ›": each changed, removed or added row is a stop. */
function Stepper({ at, count, onStep }: { at: number | null; count: number; onStep: (dir: 1 | -1) => void }) {
  const title = (dir: 1 | -1) => (dir > 0 ? "Next change (Ctrl+G)" : "Previous change (Shift+Ctrl+G)");
  return (
    <span className={styles.stepper}>
      <span className={styles.position} role="status">
        {at === null ? plural(count, "change") : `Change ${at + 1} of ${count.toLocaleString("en-US")}`}
      </span>
      {([-1, 1] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          className={liveStyles.tool}
          onClick={() => onStep(dir)}
          title={title(dir)}
          aria-label={title(dir)}
        >
          {dir > 0 ? <>&rsaquo;</> : <>&lsaquo;</>}
        </button>
      ))}
    </span>
  );
}

function NoDifferences() {
  return (
    <p className={styles.same} role="status">
      No differences.
    </p>
  );
}

function FoldButton({ fold, onOpen, gridRow }: { fold: Fold; onOpen: (from: number) => void; gridRow?: number }) {
  const count = fold.to - fold.from;
  return (
    <button type="button" className={styles.fold} style={{ gridRow }} onClick={() => onOpen(fold.from)}>
      &#8943; {count.toLocaleString("en-US")} unchanged paragraph{count === 1 ? "" : "s"} &#8943;
    </button>
  );
}

function Segments({ segments }: { segments: DiffSegment[] }) {
  return segments.map((segment, s) => {
    const text = <Text node={{ type: "text", text: segment.text, marks: segment.marks }} />;
    if (segment.op === "del") return <del key={s}>{text}</del>;
    if (segment.op === "ins") return <ins key={s}>{text}</ins>;
    return <span key={s}>{text}</span>;
  });
}

function BlockContent({ block, segments }: { block: DiffBlock; segments?: DiffSegment[] }) {
  if (block.type === "sceneBreak") return <hr data-scene-break="" />;
  return (
    <p>
      <Segments segments={segments ?? block.segments} />
    </p>
  );
}

/** A row on a phone's one column: the newer block, with the older one's removals inline. */
function InlineRow({ r, row, diff, faded }: { r: number; row: DiffRow; diff: ChapterDiff; faded: boolean }) {
  const block = row.kind === "removed" ? diff.left[row.left]! : diff.right[row.right]!;
  return (
    <div
      className={styles.cell}
      data-row={r}
      data-change={row.kind}
      data-faded={(faded && row.kind === "same") || undefined}
    >
      <BlockContent block={block} segments={row.kind === "changed" ? row.merged : undefined} />
    </div>
  );
}

/**
 * One side's heading and cells. Cells are placed on the shared grid by row, so each column is one run
 * of the DOM and a selection stays within it. The wrapper is `display: contents`.
 */
function Column({
  column,
  side,
  json,
  blocks,
  rows,
  items,
  faded,
  heading,
}: {
  column: number;
  side: Side;
  json: JSONContent;
  blocks: DiffBlock[];
  rows: DiffRow[];
  /** The rows on show; a Fold's place is left for the full-width row the grid puts there. */
  items: FoldItem[];
  faded: boolean;
  heading: (column: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gridColumn = column + 1;

  return (
    <div
      ref={ref}
      className={styles.column}
      role="group"
      aria-label={side.kind === "current" ? "Current text" : "Snapshot text"}
      onCopy={(e) => {
        const copied = clipboardContent(json, e.currentTarget, true);
        if (!copied) return;
        e.preventDefault();
        e.clipboardData.setData("text/html", copied.html);
        e.clipboardData.setData("text/plain", copied.text);
      }}
    >
      <div className={styles.head} style={{ gridColumn, gridRow: 1 }}>
        {heading(ref)}
      </div>
      {items.map((item, i) => {
        if (item.kind === "fold") return null;
        const r = item.row;
        const row = rows[r]!;
        const index = column ? row.right : row.left;
        const style = { gridColumn, gridRow: i + 2 };
        if (index === undefined) {
          return <div key={r} className={styles.gap} style={style} data-row={r} aria-hidden />;
        }
        return (
          <div
            key={r}
            className={styles.cell}
            style={style}
            data-row={r}
            data-block={index}
            data-change={row.kind}
            data-faded={(faded && row.kind === "same") || undefined}
          >
            <BlockContent block={blocks[index]!} />
          </div>
        );
      })}
    </div>
  );
}

function Heading({
  side,
  frozenAt,
  picker,
  children,
}: {
  side: Side;
  frozenAt: number | null;
  picker: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className={styles.title}>
        {picker ??
          (side.kind === "current" ? (
            <span className={styles.name}>Current text</span>
          ) : (
            side.snapshot.name && <span className={styles.name}>&ldquo;{side.snapshot.name}&rdquo;</span>
          ))}
        {side.kind === "current" ? (
          frozenAt !== null && <span className={styles.when}>as of {timeOnly.format(frozenAt)}</span>
        ) : (
          !picker && <span className={styles.when}>{takenAt.format(new Date(side.snapshot.taken_at))}</span>
        )}
      </div>
      {children}
    </>
  );
}

function SnapshotActions({
  snapshot,
  json,
  column,
  canRestore,
  canName,
  replacesOther,
  onRestore,
  onRenamed,
}: {
  snapshot: Snapshot;
  json: JSONContent;
  /** Where Copy looks for a selection; without one it copies the whole Snapshot. */
  column: React.RefObject<HTMLDivElement | null> | null;
  canRestore: boolean;
  canName: boolean;
  /** Neither side is the current text, so a Restore replaces text that isn't on screen. */
  replacesOther: boolean;
  onRestore: (snapshot: Snapshot) => Promise<Notice | null>;
  onRenamed: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [naming, setNaming] = useState(false);

  async function run(task: () => Promise<Notice | null>) {
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await task());
    } finally {
      setBusy(false);
    }
  }

  const copy = () =>
    run(async () => {
      const { html, text, whole } = clipboardContent(json, column?.current ?? null, false)!;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } catch {
        return { text: "Couldn't copy. Select the text and press Ctrl+C instead.", error: true };
      }
      return { text: `Copied ${whole ? "the whole Snapshot" : "the selection"}. Paste it into the Chapter.` };
    });

  const rename = (formData: FormData) =>
    run(async () => {
      const error = await nameSnapshot(snapshot.id, String(formData.get("name") ?? ""));
      if (error) return { text: error, error: true };
      setNaming(false);
      await onRenamed();
      return null;
    });

  return (
    <>
      <div className={styles.actions}>
        {canRestore && (
          <button
            type="button"
            className="button button-small button-primary"
            disabled={busy}
            onClick={() => {
              const message =
                "Restore this Snapshot? The Chapter's current text is saved as a Snapshot first." +
                (replacesOther ? " This replaces the current text, not the other Snapshot shown." : "");
              if (window.confirm(message)) void run(() => onRestore(snapshot));
            }}
          >
            Restore
          </button>
        )}
        <button
          type="button"
          className="button button-small"
          disabled={busy}
          // Keep the selection in the column, which the copy reads.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void copy()}
          title={
            column
              ? "Copies the text selected in this column, or the whole Snapshot if nothing is selected"
              : "Copies the whole Snapshot"
          }
        >
          Copy from this Snapshot
        </button>
        {canName && !naming && (
          <button type="button" className="button button-small button-ghost" onClick={() => setNaming(true)}>
            {snapshot.name ? "Rename" : "Name"}
          </button>
        )}
      </div>
      {naming && (
        <form action={rename} className={styles.nameForm}>
          <input
            name="name"
            className="input"
            aria-label="Snapshot name"
            maxLength={80}
            defaultValue={snapshot.name ?? ""}
            placeholder="Name this Snapshot"
            autoFocus
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              // Not the comparison's or the panel's Escape.
              e.stopPropagation();
              setNaming(false);
            }}
          />
          <button className="button button-small" disabled={busy}>
            Save
          </button>
          <button type="button" className="button button-small button-ghost" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      )}
      {notice && (
        <p role={notice.error ? "alert" : "status"} className={notice.error ? styles.error : styles.when}>
          {notice.text}
        </p>
      )}
    </>
  );
}

/**
 * A side's text for the clipboard, serialized from its own ProseMirror doc so the `author` marks paste
 * into the Chapter intact: the selection, if it lies within `column`, else the whole doc (or nothing,
 * with `selectionOnly`).
 */
function clipboardContent(json: JSONContent, column: HTMLElement | null, selectionOnly: boolean) {
  const doc = PMNode.fromJSON(chapterSchema, json);
  const range = column && selectedRange(doc, column);
  if (!range && selectionOnly) return null;
  const [from, to] = range ?? [0, doc.content.size];
  const box = document.createElement("div");
  box.append(DOMSerializer.fromSchema(chapterSchema).serializeFragment(doc.slice(from, to).content));
  return { html: box.innerHTML, text: doc.textBetween(from, to, "\n\n"), whole: !range };
}

function selectedRange(doc: PMNode, column: HTMLElement): [number, number] | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return null;
  const a = docPosition(doc, column, selection.anchorNode, selection.anchorOffset);
  const b = docPosition(doc, column, selection.focusNode, selection.focusOffset);
  if (a === null || b === null || a === b) return null;
  return [Math.min(a, b), Math.max(a, b)];
}

/** A DOM point inside one of the column's cells, as a position in its doc: the cell's block, plus the text before it. */
function docPosition(doc: PMNode, column: HTMLElement, node: globalThis.Node, offset: number): number | null {
  const cell = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>("[data-block]");
  if (!cell || !column.contains(cell)) return null;
  const index = Number(cell.dataset.block);
  if (!(index < doc.childCount)) return null;
  let start = 0;
  for (let i = 0; i < index; i++) start += doc.child(i).nodeSize;
  const block = doc.child(index);
  if (block.isLeaf) return start;
  const before = document.createRange();
  before.selectNodeContents(cell);
  before.setEnd(node, offset);
  return start + 1 + Math.min(before.toString().length, block.content.size);
}
