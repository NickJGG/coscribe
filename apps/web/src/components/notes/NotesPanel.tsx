"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useEditorState } from "@tiptap/react";
import { noteRanges } from "@coscribe/editor";
import { groupNotes, isWhole, noteQuote, type Note } from "@/lib/notes";
import { NoteIcon } from "../icons";
import { Panel, usePanelOpen, useStoryPanel } from "../StoryPanel";
import { DraftCard, NewNoteCard, NoteCard } from "./NoteMargin";
import { NoteThreadContext } from "./NoteThreads";
import { useNotes } from "./NotesProvider";
import { useStoryNotes } from "./StoryNotesProvider";
import styles from "./notes.module.css";

type Passage = { id: string; from: number; quote: string };
type Tab = "document" | "story";

const NO_PASSAGES = new Map<string, { from: number }>();

/**
 * Every Note on the Chapter or Entry in the Story's right panel: Open ones, those on the whole document first
 * and then the rest in document order, which jump to their passage; then Resolved ones, which can be
 * Reopened; then open ones whose passage is gone (Detached), which can still be replied to and Resolved
 * here. "+ Note" writes one on the whole document. For Writers, a Story tab holds the Story Notes. Closes
 * with the document.
 */
export function NotesPanel() {
  const { kind, notes, replies, editor, narrow, reveal, expanded, setExpanded, canAddWhole, wholeDraft, setWholeDraft } =
    useNotes()!;
  const story = useStoryNotes();
  const panel = useStoryPanel();
  const close = panel?.close;
  const showPanel = panel?.show;
  const open = usePanelOpen("notes");
  const params = useSearchParams();
  const linked = params.has("notes");
  const [tab, setTab] = useState<Tab>(params.get("notes") === "story" ? "story" : "document");
  const shownTab = story ? tab : "document";

  useEffect(() => () => close?.("notes"), [close]);

  // A `?notes` link (from an embedded Entry's Note count; `?notes=story` for the Story tab) opens the panel. A
  // param, not show() before navigating, since the page being left closes the panel as it unmounts.
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

  const actions =
    shownTab === "story"
      ? story?.canAdd && <AddStoryNote />
      : canAddWhole && (
          <AddNoteButton
            tip={`A Note on the whole ${docName}`}
            onClick={() => {
              setExpanded(null);
              setWholeDraft(true);
            }}
          />
        );

  return (
    <Panel name="notes" title="Notes" actions={actions}>
      {story && (
        <NoteTabs
          tab={shownTab}
          setTab={setTab}
          labels={{ document: `This ${docName}`, story: "Story" }}
          counts={{
            document: notes.filter((n) => !n.resolved_at).length,
            story: story.notes.filter((n) => !n.resolved_at).length,
          }}
        />
      )}
      <div
        className={styles.panelBody}
        role={story ? "tabpanel" : undefined}
        id={story ? `notes-pane-${shownTab}` : undefined}
        aria-labelledby={story ? `notes-tab-${shownTab}` : undefined}
      >
        {shownTab === "story" ? (
          <StoryNotesList />
        ) : !passages ? (
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
                <NoteGroup key={kind} title={title} count={group.length}>
                  {kind === "open" && draft}
                  {group.map((note) => card(note, kind))}
                </NoteGroup>
              )
          )
        )}
      </div>
    </Panel>
  );
}

function NoteTabs({
  tab,
  setTab,
  labels,
  counts,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  labels: Record<Tab, string>;
  counts: Record<Tab, number>;
}) {
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ document: null, story: null });
  const tabs: Tab[] = ["document", "story"];

  return (
    <div role="tablist" aria-label="Notes" className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t}
          ref={(el) => {
            refs.current[t] = el;
          }}
          type="button"
          role="tab"
          id={`notes-tab-${t}`}
          aria-selected={tab === t}
          aria-controls={`notes-pane-${t}`}
          tabIndex={tab === t ? 0 : -1}
          onClick={() => setTab(t)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            const next = tab === "document" ? "story" : "document";
            setTab(next);
            refs.current[next]?.focus();
          }}
        >
          {labels[t]} <span className={styles.groupCount}>{counts[t]}</span>
        </button>
      ))}
    </div>
  );
}

function NoteGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className={styles.group} aria-label={title}>
      <h3 className="smallcaps">
        {title} <span className={styles.groupCount}>{count}</span>
      </h3>
      <ol className={styles.groupList}>{children}</ol>
    </section>
  );
}

function AddNoteButton({ tip, onClick }: { tip: string; onClick: () => void }) {
  return (
    <button type="button" className="button button-ghost button-tiny" data-tip={tip} onClick={onClick}>
      + Note
    </button>
  );
}

function AddStoryNote() {
  const { setExpanded, setDrafting } = useStoryNotes()!;
  return (
    <AddNoteButton
      tip="A Note on the Story"
      onClick={() => {
        setExpanded(null);
        setDrafting(true);
      }}
    />
  );
}

/** The Story Notes: Open ones, oldest first, with the one being written on top; then Resolved ones. */
function StoryNotesList() {
  const { notes, replies, loaded, thread, canAdd, drafting, setDrafting, addStory, expanded, setExpanded } =
    useStoryNotes()!;
  const groups = useMemo(() => groupNotes(notes, NO_PASSAGES), [notes]);
  const draft = drafting && canAdd && (
    <li>
      <NewNoteCard quote={null} onSubmit={addStory} onCancel={() => setDrafting(false)} />
    </li>
  );

  const card = (note: Note) => (
    <li key={note.id}>
      <NoteCard
        note={note}
        quote={null}
        replies={replies.filter((r) => r.note_id === note.id)}
        active={expanded === note.id}
        onActivate={() => setExpanded(note.id)}
        onDeactivate={() => setExpanded(null)}
      />
    </li>
  );

  if (!loaded) return <p className="muted">Loading…</p>;
  if (notes.length === 0 && !draft) {
    return (
      <p className="muted">
        No Story Notes yet.{canAdd && " Use + Note for one on the whole Story, like how it should end."}
      </p>
    );
  }
  return (
    <NoteThreadContext value={thread}>
      {(groups.open.length > 0 || draft) && (
        <NoteGroup title="Open" count={groups.open.length}>
          {draft}
          {groups.open.map(card)}
        </NoteGroup>
      )}
      {groups.resolved.length > 0 && (
        <NoteGroup title="Resolved" count={groups.resolved.length}>
          {groups.resolved.map(card)}
        </NoteGroup>
      )}
    </NoteThreadContext>
  );
}

/**
 * The Overview's Notes panel: the Story Notes alone. A `?note=<id>` link (from a Story Note's notification)
 * opens it with that Note expanded.
 */
export function StoryNotesPanel() {
  const story = useStoryNotes();
  const panel = useStoryPanel();
  const close = panel?.close;
  const showPanel = panel?.show;
  const linked = useSearchParams().get("note");
  const revealed = useRef<string | null>(null);
  const loaded = story?.loaded;
  const found = !!linked && !!story?.notes.some((n) => n.id === linked);
  const setExpanded = story?.setExpanded;

  useEffect(() => () => close?.("notes"), [close]);

  useEffect(() => {
    if (!linked || !loaded || !found || revealed.current === linked) return;
    revealed.current = linked;
    showPanel?.("notes");
    setExpanded?.(linked);
  }, [linked, loaded, found, showPanel, setExpanded]);

  if (!story) return null;
  return (
    <Panel name="notes" title="Notes" actions={story.canAdd && <AddStoryNote />}>
      <div className={styles.panelBody}>
        <StoryNotesList />
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

/** The Overview's way into the Story Notes, with how many are open. */
export function StoryNotesButton() {
  const story = useStoryNotes();
  const panel = useStoryPanel();
  const open = usePanelOpen("notes");
  if (!story || !panel) return null;
  const count = story.notes.filter((n) => !n.resolved_at).length;

  return (
    <button type="button" className="button button-ghost" aria-expanded={open} onClick={() => panel.toggle("notes")}>
      Notes
      {count > 0 && (
        <span className={styles.groupCount}>
          {count}
          <span className="sr-only"> open</span>
        </span>
      )}
    </button>
  );
}
