"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorText, type ActionResult } from "@/lib/action-result";
import { canDeleteNote, type MemberRole } from "@/lib/story-roles";
import { NOTE_COLUMNS, REPLY_COLUMNS, type Note, type NoteReply } from "@/lib/notes";
import type { StoryAuthor } from "../LiveDocument";

export type NoteScope = { kind: "chapter" | "entry"; id: string };

type Person = { name: string; color: string };

/** What a Note's card needs to show its thread and act on it, whichever provider holds the Notes. */
export type NoteThreadValue = {
  /** Where a quoteless card says its Note is, like "Whole Chapter". */
  wholeLabel: string;
  /** On a Finished story, Notes can be read but nothing else. */
  readOnly: boolean;
  person: (id: string | null) => Person;
  isMine: (authorId: string | null) => boolean;
  canDelete: (authorId: string | null) => boolean;
  reply: (noteId: string, body: string) => Promise<ActionResult>;
  edit: (kind: "note" | "reply", id: string, body: string) => Promise<ActionResult>;
  remove: (kind: "note" | "reply", id: string) => Promise<ActionResult>;
  setResolved: (noteId: string, resolved: boolean) => Promise<ActionResult>;
};

export const NoteThreadContext = createContext<NoteThreadValue | null>(null);

export function useNoteThread() {
  return useContext(NoteThreadContext)!;
}

const FORMER_WRITER: Person = { name: "A former Writer", color: "#9a9389" };
const WHOLE_LABELS = { chapter: "Whole Chapter", entry: "Whole Entry" } as const;

function documentIds({ kind, id }: NoteScope) {
  return kind === "chapter" ? { chapter_id: id, entry_id: null } : { chapter_id: null, entry_id: id };
}

function merge<T extends { id: string; created_at: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((x) => [x.id, x]));
  for (const x of incoming) byId.set(x.id, x);
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * A scope's Notes and replies, live from `notes` and `note_replies`, with the actions on their threads.
 * `post` adds a Note on a passage, or on the whole document with a null quote, and gives its id unless it
 * failed; it marks no text.
 */
export function useNoteThreads({
  scope,
  me,
  myRole,
  authors,
  finished,
}: {
  scope: NoteScope;
  me: string;
  myRole: MemberRole;
  authors: StoryAuthor[];
  finished: boolean;
}) {
  const { kind, id: scopeId } = scope;
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<Note[]>([]);
  const [replies, setReplies] = useState<NoteReply[]>([]);
  const [loaded, setLoaded] = useState(false);
  const known = useRef({ notes: new Set<string>(), replies: new Set<string>() });
  const column = kind === "chapter" ? "chapter_id" : "entry_id";

  useEffect(() => {
    known.current = { notes: new Set(notes.map((n) => n.id)), replies: new Set(replies.map((r) => r.id)) };
  }, [notes, replies]);

  // Subscribe first and load once subscribed, so nothing that changes in between is missed.
  useEffect(() => {
    let live = true;
    const load = async () => {
      const [n, r] = await Promise.all([
        supabase.from("notes").select(NOTE_COLUMNS).eq(column, scopeId),
        supabase.from("note_replies").select(REPLY_COLUMNS).eq(column, scopeId),
      ]);
      if (!live) return;
      if (n.data) setNotes((current) => merge(current, n.data));
      if (r.data) setReplies((current) => merge(current, r.data));
      setLoaded(true);
    };
    const filter = `${column}=eq.${scopeId}`;
    const channel = supabase
      .channel(`notes:${scopeId}`)
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
  }, [supabase, column, scopeId]);

  const post = useCallback(
    async (quote: string | null, body: string): Promise<{ id: string | null; error: ActionResult }> => {
      const id = crypto.randomUUID();
      const { error } =
        kind === "chapter"
          ? await supabase.rpc("add_note", { p_id: id, p_chapter: scopeId, p_quote: quote ?? "", p_body: body })
          : await supabase.rpc("add_entry_note", { p_id: id, p_entry: scopeId, p_quote: quote ?? "", p_body: body });
      if (error) return { id: null, error: errorText(error) };
      const note: Note = {
        id,
        ...documentIds({ kind, id: scopeId }),
        author_id: me,
        quote,
        body: body.trim(),
        edited_at: null,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString(),
      };
      setNotes((current) => merge(current, [note]));
      return { id, error: null };
    },
    [supabase, kind, scopeId, me]
  );

  const reply = useCallback(
    async (noteId: string, body: string): Promise<ActionResult> => {
      const { data, error } = await supabase.rpc("reply_note", { p_note: noteId, p_body: body });
      if (error) return errorText(error);
      const now = new Date().toISOString();
      const mine = { id: data, note_id: noteId, ...documentIds({ kind, id: scopeId }), author_id: me, body: body.trim() };
      setReplies((current) => merge(current, [{ ...mine, edited_at: null, created_at: now }]));
      return null;
    },
    [supabase, kind, scopeId, me]
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
      return null;
    },
    [supabase, me]
  );

  const byId = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
  const person = useCallback((id: string | null) => (id && byId.get(id)) || FORMER_WRITER, [byId]);

  const thread = useMemo<NoteThreadValue>(
    () => ({
      wholeLabel: WHOLE_LABELS[kind],
      readOnly: finished,
      person,
      isMine: (authorId) => authorId === me,
      canDelete: (authorId) => !finished && canDeleteNote(myRole, authorId === me),
      reply,
      edit,
      remove,
      setResolved,
    }),
    [kind, finished, person, me, myRole, reply, edit, remove, setResolved]
  );

  return { notes, replies, loaded, post, thread };
}
