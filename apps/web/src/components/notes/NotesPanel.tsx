"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorState } from "@tiptap/react";
import { noteRanges } from "@coscribe/editor";
import { groupNotes, isWhole, noteQuote, type Note } from "@/lib/notes";
import { NoteIcon } from "../icons";
import { Panel, usePanelOpen, useStoryPanel } from "../StoryPanel";
import { DraftCard, NoteCard } from "./NoteMargin";
import { useNotes } from "./NotesProvider";
import styles from "./notes.module.css";

type Passage = { id: string; from: number; quote: string };

/**
 * Every Note on the Chapter or Entry in the Story's right panel: Open ones, those on the whole document first
 * and then the rest in document order, which jump to their passage; then Resolved ones, which can be
 * Reopened; then open ones whose passage is gone (Detached), which can still be replied to and Resolved
 * here. "+ Note" writes one on the whole document. Closes with the document.
 */
export function NotesPanel() {
  const { kind, notes, replies, editor, narrow, reveal, expanded, setExpanded, canAddWhole, wholeDraft, setWholeDraft } =
    useNotes()!;
  const panel = useStoryPanel();
  const close = panel?.close;
  const showPanel = panel?.show;
  const open = usePanelOpen("notes");
  const linked = useSearchParams().has("notes");

  useEffect(() => () => close?.("notes"), [close]);

  // A `?notes` link (from an embedded Entry's Note count) opens the panel. A param, not show() before
  // navigating, since the page being left closes the panel as it unmounts.
  useEffect(() => {
    if (linked) showPanel?.("notes");
  }, [linked, showPanel]);

  const passages = useEditorState({
    editor,
    selector: ({ editor }): Passage[] | null => {
      if (!editor || !open) return null;
      const { doc } = editor.state;
      return [...noteRanges(doc)].map(([id, { from, to }]) => ({
        id,
        from,
        quote: noteQuote(doc.textBetween(from, to, " ", " ")),
      }));
    },
  });
  const byId = useMemo(() => new Map(passages?.map((p) => [p.id, p])), [passages]);
  const groups = useMemo(() => groupNotes(notes, byId), [notes, byId]);

  const jump = (id: string) => {
    if (narrow) close?.("notes");
    reveal(id);
  };

  const card = (note: Note, group: "open" | "resolved" | "detached") => {
    const jumps = group === "open" && !isWhole(note);
    return (
      <li key={note.id}>
        <NoteCard
          note={note}
          quote={(group === "open" && byId.get(note.id)?.quote) || note.quote}
          replies={replies.filter((r) => r.note_id === note.id)}
          active={!jumps && expanded === note.id}
          detached={group === "detached"}
          onActivate={() => (jumps ? jump(note.id) : setExpanded(note.id))}
          onDeactivate={() => setExpanded(null)}
        />
      </li>
    );
  };

  const docName = kind === "chapter" ? "Chapter" : "Entry";
  const draft = wholeDraft && canAddWhole && (
    <li>
      <DraftCard quote={null} />
    </li>
  );

  return (
    <Panel
      name="notes"
      title="Notes"
      actions={
        canAddWhole && (
          <button
            type="button"
            className="button button-ghost button-tiny"
            data-tip={`A Note on the whole ${docName}`}
            onClick={() => {
              setExpanded(null);
              setWholeDraft(true);
            }}
          >
            + Note
          </button>
        )
      }
    >
      <div className={styles.panelBody}>
        {!passages ? (
          <p className="muted">Loading…</p>
        ) : notes.length === 0 && !draft ? (
          <p className="muted">
            No Notes yet. Select some text and choose Add Note
            {canAddWhole ? `, or use + Note for the whole ${docName}.` : "."}
          </p>
        ) : (
          (
            [
              ["Open", "open", groups.open],
              ["Resolved", "resolved", groups.resolved],
              ["Detached", "detached", groups.detached],
            ] as const
          ).map(
            ([title, kind, group]) =>
              (group.length > 0 || (kind === "open" && draft)) && (
                <section key={kind} className={styles.group} aria-label={title}>
                  <h3 className="smallcaps">
                    {title} <span className={styles.groupCount}>{group.length}</span>
                  </h3>
                  <ol className={styles.groupList}>
                    {kind === "open" && draft}
                    {group.map((note) => card(note, kind))}
                  </ol>
                </section>
              )
          )
        )}
      </div>
    </Panel>
  );
}

/** The toolbar's way into the Notes panel, with how many Notes are open. */
export function NotesButton() {
  const notes = useNotes();
  const panel = useStoryPanel();
  const open = usePanelOpen("notes");
  if (!notes || !panel) return null;
  const count = notes.notes.filter((n) => !n.resolved_at).length;

  return (
    <button
      type="button"
      className="button button-ghost button-tiny with-icon"
      data-tip="Notes"
      aria-expanded={open}
      onClick={() => panel.toggle("notes")}
    >
      <NoteIcon />
      <span className="with-icon-label">Notes</span>
      {count > 0 && (
        <span className={styles.groupCount}>
          {count}
          <span className="sr-only"> open</span>
        </span>
      )}
    </button>
  );
}
