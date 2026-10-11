"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorState } from "@tiptap/react";
import { noteRanges } from "@coscribe/editor";
import { groupNotes, noteQuote, type Note } from "@/lib/notes";
import { NoteIcon } from "../icons";
import { Panel, usePanelOpen, useStoryPanel } from "../StoryPanel";
import { NoteCard } from "./NoteMargin";
import { useNotes } from "./NotesProvider";
import styles from "./notes.module.css";

type Passage = { id: string; from: number; quote: string };

/**
 * Every Note on the Chapter in the Story's right panel: Open ones in document order, which jump to their
 * passage; then Resolved ones, which can be Reopened; then open ones whose passage is gone (Detached),
 * which can still be replied to and Resolved here. Closes with the Chapter.
 */
export function NotesPanel() {
  const { notes, replies, editor, narrow, reveal } = useNotes()!;
  const close = useStoryPanel()?.close;
  const open = usePanelOpen("notes");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => () => close?.("notes"), [close]);

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

  const card = (note: Note, kind: "open" | "resolved" | "detached") => (
    <li key={note.id}>
      <NoteCard
        note={note}
        quote={(kind === "open" && byId.get(note.id)?.quote) || note.quote}
        replies={replies.filter((r) => r.note_id === note.id)}
        active={kind !== "open" && expanded === note.id}
        detached={kind === "detached"}
        onActivate={() => (kind === "open" ? jump(note.id) : setExpanded(note.id))}
        onDeactivate={() => setExpanded(null)}
      />
    </li>
  );

  return (
    <Panel name="notes" title="Notes">
      <div className={styles.panelBody}>
        {!passages ? (
          <p className="muted">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="muted">No Notes yet. Select some text and choose Add Note.</p>
        ) : (
          (
            [
              ["Open", "open", groups.open],
              ["Resolved", "resolved", groups.resolved],
              ["Detached", "detached", groups.detached],
            ] as const
          ).map(
            ([title, kind, group]) =>
              group.length > 0 && (
                <section key={kind} className={styles.group} aria-label={title}>
                  <h3 className="smallcaps">
                    {title} <span className={styles.groupCount}>{group.length}</span>
                  </h3>
                  <ol className={styles.groupList}>{group.map((note) => card(note, kind))}</ol>
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
