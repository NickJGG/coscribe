"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { noteRanges } from "@coscribe/editor";
import { relativeTime } from "@/lib/relative-time";
import { useMeasure } from "@/lib/use-measure";
import { NOTE_BODY_MAX, noteQuote, stackCards, type Note, type NoteReply } from "@/lib/notes";
import type { ActionResult } from "@/lib/action-result";
import { Avatar } from "../Avatar";
import { Dropdown } from "../Dropdown";
import { canAddNote, noteDraft } from "./NoteHighlights";
import { useNotes } from "./NotesProvider";
import styles from "./notes.module.css";

const DRAFT = "draft";
const GAP = 10;
/** Lifts a card so its quote lines up with the passage rather than its border. */
const LIFT = 10;

type Placement = { tops: Record<string, number>; bottom: number };
const NOT_PLACED: Placement = { tops: {}, bottom: 0 };
const NO_BUTTON: { top: number; left: number } | null = null;

/**
 * Laid over the Authorship box: the "Add Note" button over a selection, and with Show Notes on, the margin
 * of cards beside the text, one per open Note whose passage is in the Chapter, plus the one being written.
 */
export function NoteLayer({ editor }: { editor: Editor }) {
  const notes = useNotes()!;
  const layer = useRef<HTMLDivElement>(null);
  const roots = useMemo(() => [layer], []);
  const selection = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor.isFocused && canAddNote(editor) && !noteDraft(editor.state) ? editor.state.selection.from : null,
  });

  const measure = useCallback(() => {
    const origin = layer.current!.getBoundingClientRect();
    const at = editor.view.coordsAtPos(selection!);
    return { top: at.top - origin.top, left: at.left - origin.left };
  }, [editor, selection]);
  const button = useMeasure(roots, selection === null ? null : measure, NO_BUTTON);

  return (
    <div ref={layer} className={styles.layer}>
      {button && selection !== null && (
        <button
          type="button"
          className={styles.addButton}
          style={{ top: button.top, left: button.left }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={notes.startDraft}
        >
          + Add Note
        </button>
      )}
      {notes.show && <NoteMargin editor={editor} />}
    </div>
  );
}

function NoteMargin({ editor }: { editor: Editor }) {
  const { notes, replies, active, setActive } = useNotes()!;
  const column = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const prose = useMemo(() => ({ current: editor.view.dom }), [editor]);
  const roots = useMemo(() => [prose, column], [prose]);

  const openIds = useMemo(() => new Set(notes.filter((n) => !n.resolved_at).map((n) => n.id)), [notes]);
  // Live passage text by Note, in document order, plus the draft's.
  const passages = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { doc } = editor.state;
      const quote = ({ from, to }: { from: number; to: number }) => noteQuote(doc.textBetween(from, to, " ", " "));
      const shown = [...noteRanges(doc)].filter(([id]) => openIds.has(id));
      const draft = noteDraft(editor.state);
      const all = draft ? [...shown, [DRAFT, draft] as const] : shown;
      return all.sort(([, a], [, b]) => a.from - b.from).map(([id, range]) => ({ id, quote: quote(range) }));
    },
  });

  const activeKey = passages.some((p) => p.id === DRAFT) ? DRAFT : active;
  const keys = passages.map((p) => p.id).join(" ");

  const measure = useCallback(() => {
    const origin = column.current!.getBoundingClientRect().top;
    const ranges = noteRanges(editor.state.doc);
    const draft = noteDraft(editor.state);
    const order = keys ? keys.split(" ") : [];
    const wants = order.map((key) => {
      const range = key === DRAFT ? draft : ranges.get(key);
      return range ? editor.view.coordsAtPos(range.from).top - origin - LIFT : 0;
    });
    const heights = order.map((key) => cards.current.get(key)?.offsetHeight ?? 0);
    const tops = stackCards(wants, heights, order.indexOf(activeKey ?? ""), GAP);
    return {
      tops: Object.fromEntries(order.map((key, i) => [key, Math.round(tops[i]!)])),
      bottom: Math.max(0, ...tops.map((t, i) => t + heights[i]!)),
    };
  }, [editor, keys, activeKey]);
  const placement = useMeasure(roots, measure, NOT_PLACED);

  const ref = (key: string) => (el: HTMLElement | null) => {
    if (el) cards.current.set(key, el);
    else cards.current.delete(key);
  };
  const place = (key: string): React.CSSProperties => {
    const top = placement.tops[key];
    return top === undefined ? { visibility: "hidden" } : { top };
  };

  return (
    <div ref={column} className={styles.margin} style={{ minHeight: placement.bottom }} data-note-margin>
      {passages.map(({ id, quote }) => {
        if (id === DRAFT) return <DraftCard key={DRAFT} ref={ref(DRAFT)} style={place(DRAFT)} quote={quote} />;
        const note = notes.find((n) => n.id === id);
        if (!note) return null;
        return (
          <NoteCard
            key={id}
            ref={ref(id)}
            style={place(id)}
            note={note}
            quote={quote}
            replies={replies.filter((r) => r.note_id === id)}
            active={active === id}
            onActivate={() => active !== id && setActive(id)}
          />
        );
      })}
    </div>
  );
}

function DraftCard({ ref, style, quote }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties; quote: string }) {
  const { addNote, cancelDraft } = useNotes()!;

  return (
    <div ref={ref} className={styles.card} data-active style={style}>
      <blockquote className={styles.quote}>{quote}</blockquote>
      <Compose placeholder="Add a Note…" submit="Note" onSubmit={addNote} onCancel={cancelDraft} autoFocus />
    </div>
  );
}

export function NoteCard({
  ref,
  style,
  note,
  quote,
  replies,
  active,
  onActivate,
}: {
  ref?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  note: Note;
  quote: string;
  replies: NoteReply[];
  active: boolean;
  onActivate: () => void;
}) {
  const { readOnly, reply, setResolved, setActive } = useNotes()!;
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      ref={ref}
      className={styles.card}
      data-active={active || undefined}
      style={style}
      onClick={onActivate}
      onFocus={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Escape" && active && !e.defaultPrevented) setActive(null);
      }}
    >
      <blockquote className={styles.quote}>{quote}</blockquote>
      <Message kind="note" message={note} active={active} />
      {replies.length > 0 && (
        <ol className={styles.replies}>
          {replies.map((r) => (
            <li key={r.id}>
              <Message kind="reply" message={r} active={active} />
            </li>
          ))}
        </ol>
      )}
      {active && !readOnly && (
        <div className={styles.actions}>
          <Compose placeholder="Reply…" submit="Reply" onSubmit={(body) => reply(note.id, body)} />
          <button
            type="button"
            className={`button button-ghost button-tiny ${styles.resolve}`}
            onClick={async () => setError(await setResolved(note.id, true))}
          >
            &#10003; Resolve
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

function Message({
  kind,
  message,
  active,
}: {
  kind: "note" | "reply";
  message: Note | NoteReply;
  active: boolean;
}) {
  const { person, isMine, canDelete, readOnly, edit, remove } = useNotes()!;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = person(message.author_id);
  const editable = !readOnly && isMine(message.author_id);
  const deletable = canDelete(message.author_id);

  async function onDelete() {
    const question = kind === "note" ? "Delete this Note and its replies?" : "Delete this reply?";
    if (confirm(question)) setError(await remove(kind, message.id));
  }

  return (
    <div className={styles.message}>
      <Avatar name={who.name} color={who.color} size="sm" />
      <div className={styles.messageMain}>
        <div className={styles.byline}>
          <b className={styles.name}>{who.name}</b>
          <time dateTime={message.created_at} className={styles.when}>
            {relativeTime(Date.parse(message.created_at))}
          </time>
          {message.edited_at && <span className={styles.when}>edited</span>}
          {active && !editing && (editable || deletable) && (
            <Dropdown
              label={kind === "note" ? "Note options" : "Reply options"}
              trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
              className={styles.more}
              triggerClassName={styles.moreButton}
              panelClassName={styles.menu}
            >
              {editable && (
                <button type="button" className={styles.menuItem} onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              {deletable && (
                <button type="button" className={`${styles.menuItem} ${styles.danger}`} onClick={onDelete}>
                  Delete
                </button>
              )}
            </Dropdown>
          )}
        </div>
        {editing ? (
          <Compose
            initial={message.body}
            submit="Save"
            onSubmit={async (body) => {
              const result = await edit(kind, message.id, body);
              if (!result) setEditing(false);
              return result;
            }}
            onCancel={() => setEditing(false)}
            autoFocus
          />
        ) : (
          <p className={styles.body}>{message.body}</p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** A Note, reply or edit box. Enter sends, Shift+Enter starts a new line, Escape cancels. */
function Compose({
  initial = "",
  placeholder,
  submit,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  initial?: string;
  placeholder?: string;
  submit: string;
  onSubmit: (body: string) => Promise<ActionResult>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send() {
    if (!body.trim() || pending) return;
    setPending(true);
    const result = await onSubmit(body);
    setPending(false);
    setError(result);
    if (!result) setBody("");
  }

  return (
    <form
      className={styles.compose}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <textarea
        className={`input ${styles.input}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder ?? "Message"}
        maxLength={NOTE_BODY_MAX}
        rows={1}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          } else if (e.key === "Escape" && onCancel) {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      {(onCancel || body.trim()) && (
        <div className={styles.composeButtons}>
          {onCancel && (
            <button type="button" className="button button-ghost button-tiny" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="button button-primary button-tiny" disabled={!body.trim() || pending}>
            {submit}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
