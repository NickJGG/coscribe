"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Editor } from "@tiptap/core";
import { noteRanges } from "@coscribe/editor";
import { createClient } from "@/lib/supabase/client";
import { errorText, type ActionResult } from "@/lib/action-result";
import { useLocalSetting } from "@/lib/local-setting";
import { canDeleteNote, type MemberRole } from "@/lib/story-roles";
import { NOTE_COLUMNS, noteQuote, REPLY_COLUMNS, type Note, type NoteReply } from "@/lib/notes";
import { useDeskScroll } from "../DeskScroll";
import type { StoryAuthor } from "../LiveDocument";
import { useStoryPanel } from "../StoryPanel";
import { canAddNote, noteClass, noteDraft, noteHighlightKey, type NoteHighlightMeta } from "./NoteHighlights";

type Person = { name: string; color: string };

type NotesValue = {
  notes: Note[];
  replies: NoteReply[];
  /** The Note whose card (and highlight) is active. */
  active: string | null;
  setActive: (id: string | null) => void;
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
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  person: (id: string | null) => Person;
  isMine: (authorId: string | null) => boolean;
  canDelete: (authorId: string | null) => boolean;
  /** Starts a Note on the selected text, as a draft card. */
  startDraft: () => void;
  cancelDraft: () => void;
  addNote: (body: string) => Promise<ActionResult>;
  reply: (noteId: string, body: string) => Promise<ActionResult>;
  edit: (kind: "note" | "reply", id: string, body: string) => Promise<ActionResult>;
  remove: (kind: "note" | "reply", id: string) => Promise<ActionResult>;
  setResolved: (noteId: string, resolved: boolean) => Promise<ActionResult>;
};

const NotesContext = createContext<NotesValue | null>(null);

/** The open Chapter's Notes, or null where there are none to show (Entries, Viewers). */
export function useNotes() {
  return useContext(NotesContext);
}

const SHOW_KEY = "coscribe:show-notes";
const FORMER_WRITER: Person = { name: "A former Writer", color: "#9a9389" };
const REVEAL_TRIES = 10;
/**
 * The narrowest page with its margin (chapter.module.css): the text centered between two columns of a gap
 * and the narrowest cards, plus both gutters. Narrower, the text would have to move over to fit them.
 * desk.module.css caps the sidebar's width with the same numbers.
 */
const MARGIN_PAGE_REM = 40 + 2 * 15;
const MARGIN_PAGE_PX = 2 * 32 + 2 * 16;

function merge<T extends { id: string; created_at: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((x) => [x.id, x]));
  for (const x of incoming) byId.set(x.id, x);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * A Chapter's Notes for its members, live from `notes` and `note_replies`, plus the actions on them. The
 * Chapter's LiveDocument hands over its editor, which carries the `note` marks and the highlights; a
 * `?note=<id>` link activates that Note and scrolls to it once both have loaded.
 */
export function NotesProvider({
  chapterId,
  me,
  myRole,
  authors,
  finished,
  children,
}: {
  chapterId: string;
  me: string;
  myRole: MemberRole;
  authors: StoryAuthor[];
  finished: boolean;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<Note[]>([]);
  const [replies, setReplies] = useState<NoteReply[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [show, setShow] = useLocalSetting(SHOW_KEY, true);
  const [editor, setEditorState] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const known = useRef({ notes: new Set<string>(), replies: new Set<string>() });
  const linked = useSearchParams().get("note");
  const revealed = useRef<string | null>(null);
  const narrow = useNarrowDesk();
  const panelOpen = !!useStoryPanel()?.open;
  const collapsed = narrow || panelOpen;

  useEffect(() => {
    known.current = { notes: new Set(notes.map((n) => n.id)), replies: new Set(replies.map((r) => r.id)) };
  }, [notes, replies]);

  // Subscribe first and load once subscribed, so nothing that changes in between is missed.
  useEffect(() => {
    let live = true;
    const load = async () => {
      const [n, r] = await Promise.all([
        supabase.from("notes").select(NOTE_COLUMNS).eq("chapter_id", chapterId),
        supabase.from("note_replies").select(REPLY_COLUMNS).eq("chapter_id", chapterId),
      ]);
      if (!live) return;
      if (n.data) setNotes((current) => merge(current, n.data));
      if (r.data) setReplies((current) => merge(current, r.data));
      setLoaded(true);
    };
    const filter = `chapter_id=eq.${chapterId}`;
    const channel = supabase
      .channel(`notes:${chapterId}`)
      .on<Note>("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter }, ({ new: note }) =>
        setNotes((current) => merge(current, [note]))
      )
      .on<Note>("postgres_changes", { event: "UPDATE", schema: "public", table: "notes", filter }, ({ new: note }) =>
        setNotes((current) => merge(current, [note]))
      )
      .on<NoteReply>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "note_replies", filter },
        ({ new: reply }) => setReplies((current) => merge(current, [reply]))
      )
      .on<NoteReply>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "note_replies", filter },
        ({ new: reply }) => setReplies((current) => merge(current, [reply]))
      )
      // Realtime can't filter deletes, so each brings only an id: drop it only if it's one of ours.
      .on<{ id: string }>("postgres_changes", { event: "DELETE", schema: "public", table: "notes" }, ({ old }) => {
        if (!old.id || !known.current.notes.has(old.id)) return;
        setNotes((current) => current.filter((n) => n.id !== old.id));
        setReplies((current) => current.filter((r) => r.note_id !== old.id));
      })
      .on<{ id: string }>("postgres_changes", { event: "DELETE", schema: "public", table: "note_replies" }, ({ old }) => {
        if (old.id && known.current.replies.has(old.id)) setReplies((current) => current.filter((r) => r.id !== old.id));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, chapterId]);

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
    if (!linked || !editor || !loaded || revealed.current === linked) return;
    if (!openIds.has(linked) || !noteRanges(editor.state.doc).has(linked)) return;
    const frame = requestAnimationFrame(() => {
      revealed.current = linked;
      reveal(linked);
    });
    return () => cancelAnimationFrame(frame);
  }, [linked, editor, loaded, openIds, reveal]);

  const byId = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const person = useCallback((id: string | null) => (id && byId.get(id)) || FORMER_WRITER, [byId]);

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
      const id = crypto.randomUUID();
      const { error } = await supabase.rpc("add_note", { p_id: id, p_chapter: chapterId, p_quote: quote, p_body: body });
      if (error) return errorText(error);

      // Others may have edited while the insert ran; the draft range has moved with their edits.
      const meta: NoteHighlightMeta = { draft: null };
      if (!ed.isDestroyed) {
        const range = noteDraft(ed.state);
        const tr = ed.state.tr.setMeta(noteHighlightKey, meta);
        if (range && ed.isEditable) tr.addMark(range.from, range.to, ed.schema.marks.note!.create({ id }));
        ed.view.dispatch(tr);
      }
      const now = new Date().toISOString();
      setNotes((current) =>
        merge(current, [
          {
            id,
            chapter_id: chapterId,
            author_id: me,
            quote,
            body: body.trim(),
            edited_at: null,
            resolved_at: null,
            resolved_by: null,
            created_at: now,
          },
        ])
      );
      setActive(id);
      return null;
    },
    [supabase, chapterId, me]
  );

  const reply = useCallback(
    async (noteId: string, body: string): Promise<ActionResult> => {
      const { data, error } = await supabase.rpc("reply_note", { p_note: noteId, p_body: body });
      if (error) return errorText(error);
      const now = new Date().toISOString();
      const mine = { id: data, note_id: noteId, chapter_id: chapterId, author_id: me, body: body.trim() };
      setReplies((current) => merge(current, [{ ...mine, edited_at: null, created_at: now }]));
      return null;
    },
    [supabase, chapterId, me]
  );

  const edit = useCallback(
    async (kind: "note" | "reply", id: string, body: string): Promise<ActionResult> => {
      const trimmed = body.trim();
      if (kind === "note") {
        const { data, error } = await supabase.from("notes").update({ body: trimmed }).eq("id", id).select(NOTE_COLUMNS);
        if (error) return errorText(error);
        if (!data.length) return errorText({ message: "not_allowed" });
        setNotes((current) => merge(current, data));
      } else {
        const { data, error } = await supabase
          .from("note_replies")
          .update({ body: trimmed })
          .eq("id", id)
          .select(REPLY_COLUMNS);
        if (error) return errorText(error);
        if (!data.length) return errorText({ message: "not_allowed" });
        setReplies((current) => merge(current, data));
      }
      return null;
    },
    [supabase]
  );

  const remove = useCallback(
    async (kind: "note" | "reply", id: string): Promise<ActionResult> => {
      const { data, error } = await supabase
        .from(kind === "note" ? "notes" : "note_replies")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) return errorText(error);
      if (!data.length) return errorText({ message: "not_allowed" });
      if (kind === "reply") {
        setReplies((current) => current.filter((r) => r.id !== id));
        return null;
      }
      setNotes((current) => current.filter((n) => n.id !== id));
      setReplies((current) => current.filter((r) => r.note_id !== id));
      // A leftover mark would be inert, so this is best effort: a read-only editor can't write it anyway.
      const ed = editorRef.current;
      const range = ed && !ed.isDestroyed && ed.isEditable ? noteRanges(ed.state.doc).get(id) : undefined;
      if (ed && range) ed.view.dispatch(ed.state.tr.removeMark(range.from, range.to, ed.schema.marks.note!.create({ id })));
      return null;
    },
    [supabase]
  );

  const setResolved = useCallback(
    async (noteId: string, resolved: boolean): Promise<ActionResult> => {
      const { error } = await supabase.rpc("set_note_resolved", { p_note: noteId, p_resolved: resolved });
      if (error) return errorText(error);
      const now = new Date().toISOString();
      setNotes((current) =>
        current.map((n) =>
          n.id === noteId ? { ...n, resolved_at: resolved ? now : null, resolved_by: resolved ? me : null } : n
        )
      );
      if (resolved) setActive((current) => (current === noteId ? null : current));
      return null;
    },
    [supabase, me]
  );

  const value = useMemo<NotesValue>(
    () => ({
      notes,
      replies,
      active: shownActive,
      setActive,
      show,
      setShow,
      narrow,
      collapsed,
      reveal,
      readOnly: finished,
      editor,
      setEditor,
      person,
      isMine: (authorId) => authorId === me,
      canDelete: (authorId) => !finished && canDeleteNote(myRole, authorId === me),
      startDraft,
      cancelDraft,
      addNote,
      reply,
      edit,
      remove,
      setResolved,
    }),
    [
      notes,
      replies,
      shownActive,
      show,
      setShow,
      narrow,
      collapsed,
      reveal,
      finished,
      editor,
      setEditor,
      person,
      me,
      myRole,
      startDraft,
      cancelDraft,
      addNote,
      reply,
      edit,
      remove,
      setResolved,
    ]
  );

  return <NotesContext value={value}>{children}</NotesContext>;
}

/** Whether the desk's page is narrower than the text and its margin of cards, as the sidebar and window change. */
function useNarrowDesk() {
  const scroll = useDeskScroll();
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = scroll?.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setNarrow(el.clientWidth < MARGIN_PAGE_REM * rem + MARGIN_PAGE_PX);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scroll]);

  return narrow;
}
