"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Editor } from "@tiptap/core";
import { noteRanges } from "@coscribe/editor";
import type { ActionResult } from "@/lib/action-result";
import { useLocalSetting } from "@/lib/local-setting";
import type { MemberRole } from "@/lib/story-roles";
import { isWhole, noteQuote, type Note, type NoteReply } from "@/lib/notes";
import { useNarrowDesk } from "../DeskScroll";
import type { LiveKind, StoryAuthor } from "../LiveDocument";
import { useStoryPanel } from "../StoryPanel";
import { canAddNote, noteClass, noteDraft, noteHighlightKey, type NoteHighlightMeta } from "./NoteHighlights";
import { NoteThreadContext, useNoteThreads } from "./NoteThreads";

type NotesValue = {
  kind: LiveKind;
  notes: Note[];
  replies: NoteReply[];
  /** The Note whose card (and highlight) is active. */
  active: string | null;
  setActive: (id: string | null) => void;
  /** The Note whose card is open in the Notes panel, if it isn't one that jumps to its passage. */
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  show: boolean;
  setShow: (show: boolean) => void;
  /** The Desk is too narrow for the margin beside the text. */
  narrow: boolean;
  /** No margin: too narrow, or a panel is open. Each paragraph's Notes are behind a marker instead. */
  collapsed: boolean;
  /** Turns Show notes on, activates the Note and scrolls to its passage. */
  reveal: (id: string) => void;
  /** On a Finished story, Notes can be read but nothing else. */
  readOnly: boolean;
  /** A Note on the whole document can be started: not read-only, nor a locked Chapter. */
  canAddWhole: boolean;
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  /** Starts a Note on the selected text, as a draft card. */
  startDraft: () => void;
  cancelDraft: () => void;
  addNote: (body: string) => Promise<ActionResult>;
  /** A Note on the whole document is being written in the Notes panel. */
  wholeDraft: boolean;
  setWholeDraft: (drafting: boolean) => void;
  addWhole: (body: string) => Promise<ActionResult>;
};

const NotesContext = createContext<NotesValue | null>(null);

/** The open Chapter's or Entry's Notes, or null where there are none to show (embedded Entry bodies, Viewers). */
export function useNotes() {
  return useContext(NotesContext);
}

const SHOW_KEY = "coscribe:show-notes";
const REVEAL_TRIES = 10;

/**
 * A Chapter's or Entry's Notes for its members (useNoteThreads), with the editor's side of them. The
 * document's LiveDocument hands over its editor, which carries the `note` marks and the highlights; a
 * `?note=<id>` link activates that Note and scrolls to it once both have loaded, or opens the Notes panel
 * on it for a Note on the whole document.
 */
export function NotesProvider({
  doc: { kind, id: docId },
  me,
  myRole,
  authors,
  finished,
  locked = false,
  children,
}: {
  doc: { kind: LiveKind; id: string };
  me: string;
  myRole: MemberRole;
  authors: StoryAuthor[];
  finished: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const scope = useMemo(() => ({ kind, id: docId }), [kind, docId]);
  const { notes, replies, loaded, post, thread } = useNoteThreads({ scope, me, myRole, authors, finished });
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [wholeDraft, setWholeDraft] = useState(false);
  const [show, setShow] = useLocalSetting(SHOW_KEY, true);
  const [editor, setEditorState] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const linked = useSearchParams().get("note");
  const revealed = useRef<string | null>(null);
  const narrow = !!useNarrowDesk();
  const panel = useStoryPanel();
  const showPanel = panel?.show;
  const collapsed = narrow || !!panel?.open;

  const openIds = useMemo(() => new Set(notes.filter((n) => !n.resolved_at).map((n) => n.id)), [notes]);
  const shownActive = active && openIds.has(active) ? active : null;

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const meta: NoteHighlightMeta = { openIds, activeId: shownActive, show, collapsed };
    editor.view.dispatch(editor.state.tr.setMeta(noteHighlightKey, meta));
  }, [editor, openIds, shownActive, show, collapsed]);

  const setEditor = useCallback((next: Editor | null) => {
    editorRef.current = next;
    setEditorState(next);
  }, []);

  const reveal = useCallback((id: string) => {
    setShow(true);
    setActive(id);
    let tries = 0;
    const find = () => {
      const span = editorRef.current?.view.dom.querySelector(`.${noteClass(id)}`);
      if (span) span.scrollIntoView({ block: "center" });
      else if (++tries < REVEAL_TRIES) requestAnimationFrame(find);
    };
    requestAnimationFrame(find);
  }, [setShow]);

  useEffect(() => {
    if (!linked || !loaded || revealed.current === linked) return;
    const note = notes.find((n) => n.id === linked);
    const whole = !!note && isWhole(note);
    if (!whole && (!editor || !openIds.has(linked) || !noteRanges(editor.state.doc).has(linked))) return;
    const frame = requestAnimationFrame(() => {
      revealed.current = linked;
      if (whole) {
        showPanel?.("notes");
        setExpanded(linked);
      } else {
        reveal(linked);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [linked, editor, loaded, notes, openIds, reveal, showPanel]);

  const startDraft = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || !canAddNote(ed)) return;
    const { from, to } = ed.state.selection;
    const meta: NoteHighlightMeta = { draft: { from, to } };
    ed.view.dispatch(ed.state.tr.setMeta(noteHighlightKey, meta));
    setActive(null);
    setShow(true);
  }, [setShow]);

  const cancelDraft = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed || !noteDraft(ed.state)) return;
    const meta: NoteHighlightMeta = { draft: null };
    ed.view.dispatch(ed.state.tr.setMeta(noteHighlightKey, meta));
  }, []);

  const addNote = useCallback(
    async (body: string): Promise<ActionResult> => {
      const ed = editorRef.current;
      const draft = ed && noteDraft(ed.state);
      if (!ed || !draft) return "Select the passage again.";
      const quote = noteQuote(ed.state.doc.textBetween(draft.from, draft.to, " ", " "));
      if (!quote) return "Select some text to note.";
      const result = await post(quote, body);
      if (!result.id) return result.error;

      // Others may have edited while the insert ran; the draft range has moved with their edits.
      const meta: NoteHighlightMeta = { draft: null };
      if (!ed.isDestroyed) {
        const range = noteDraft(ed.state);
        const tr = ed.state.tr.setMeta(noteHighlightKey, meta);
        if (range && ed.isEditable) tr.addMark(range.from, range.to, ed.schema.marks.note!.create({ id: result.id }));
        ed.view.dispatch(tr);
      }
      setActive(result.id);
      return null;
    },
    [post]
  );

  const addWhole = useCallback(
    async (body: string): Promise<ActionResult> => {
      const result = await post(null, body);
      if (!result.id) return result.error;
      setWholeDraft(false);
      return null;
    },
    [post]
  );

  const { remove: removeThread, setResolved: setThreadResolved } = thread;

  const remove = useCallback(
    async (kind: "note" | "reply", id: string): Promise<ActionResult> => {
      const result = await removeThread(kind, id);
      if (result || kind === "reply") return result;
      // A leftover mark would be inert, so this is best effort: a read-only editor can't write it anyway.
      const ed = editorRef.current;
      const range = ed && !ed.isDestroyed && ed.isEditable ? noteRanges(ed.state.doc).get(id) : undefined;
      if (ed && range) ed.view.dispatch(ed.state.tr.removeMark(range.from, range.to, ed.schema.marks.note!.create({ id })));
      return null;
    },
    [removeThread]
  );

  const setResolved = useCallback(
    async (noteId: string, resolved: boolean): Promise<ActionResult> => {
      const result = await setThreadResolved(noteId, resolved);
      if (!result && resolved) setActive((current) => (current === noteId ? null : current));
      return result;
    },
    [setThreadResolved]
  );

  const threadValue = useMemo(() => ({ ...thread, remove, setResolved }), [thread, remove, setResolved]);

  const value = useMemo<NotesValue>(
    () => ({
      kind,
      notes,
      replies,
      active: shownActive,
      setActive,
      expanded,
      setExpanded,
      show,
      setShow,
      narrow,
      collapsed,
      reveal,
      readOnly: finished,
      canAddWhole: !finished && !locked,
      editor,
      setEditor,
      startDraft,
      cancelDraft,
      addNote,
      wholeDraft,
      setWholeDraft,
      addWhole,
    }),
    [
      kind,
      notes,
      replies,
      shownActive,
      expanded,
      show,
      setShow,
      narrow,
      collapsed,
      reveal,
      finished,
      locked,
      editor,
      setEditor,
      startDraft,
      cancelDraft,
      addNote,
      wholeDraft,
      addWhole,
    ]
  );

  return (
    <NotesContext value={value}>
      <NoteThreadContext value={threadValue}>{children}</NoteThreadContext>
    </NotesContext>
  );
}
