"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { noteRanges } from "@coscribe/editor";
import { hasOpenLayer } from "@/lib/layers";
import { relativeTime } from "@/lib/relative-time";
import { useMeasure } from "@/lib/use-measure";
import { markerGroups, NOTE_BODY_MAX, noteQuote, stackCards, type Note, type NoteReply } from "@/lib/notes";
import type { ActionResult } from "@/lib/action-result";
import { toEditableText, toStoredBody } from "@/lib/writer-mentions";
import { Avatar } from "../Avatar";
import { ConfirmDialog } from "../ConfirmDialog";
import { Dropdown } from "../Dropdown";
import { useDismiss } from "../useDismiss";
import { usePeople, useStoryMembers } from "../StoryMembers";
import { WriterMentionPicker, useWriterMentionPicker } from "../WriterMentionPicker";
import { WriterMentionText } from "../WriterMentionText";
import { noteClass, noteDraft } from "./NoteHighlights";
import { useNotes } from "./NotesProvider";
import styles from "./notes.module.css";

const DRAFT = "draft";
const GAP = 10;
/** Lifts a card so its quote lines up with the passage rather than its border. */
const LIFT = 10;

type Placement = { tops: Record<string, number>; bottom: number };
const NOT_PLACED: Placement = { tops: {}, bottom: 0 };
const NOT_ANCHORED: { top: number; left: number } | null = null;
const POPOVER_GAP = 6;
const NO_IDS: string[] = [];

/**
 * Laid over the Authorship box: with Show notes on, the margin of cards beside the text, one per open Note
 * whose passage is in the document, plus the one being written. Collapsed, the active Note (or the one being
 * written) opens in a popover instead. The "+ Note" button lives in SelectionActions.
 */
export function NoteLayer({ editor }: { editor: Editor }) {
  const notes = useNotes()!;
  const layer = useRef<HTMLDivElement>(null);

  return (
    <div ref={layer} className={styles.layer}>
      {notes.show && (notes.collapsed ? <NotePopover editor={editor} layer={layer} /> : <NoteMargin editor={editor} />)}
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
            onDeactivate={() => setActive(null)}
          />
        );
      })}
    </div>
  );
}

/**
 * The active Note's thread, or the Note being written, under its marker (or passage); a bottom sheet on
 * phones. Several Notes in one paragraph share a marker, so it steps between them. A click outside or
 * Escape closes it, except while writing a Note, which only Cancel ends.
 */
function NotePopover({ editor, layer }: { editor: Editor; layer: React.RefObject<HTMLDivElement | null> }) {
  const { notes, replies, active, setActive } = useNotes()!;
  const panel = useRef<HTMLDivElement>(null);
  const prose = useMemo(() => ({ current: editor.view.dom }), [editor]);
  const roots = useMemo(() => [prose, layer], [prose, layer]);
  const openIds = useMemo(() => new Set(notes.filter((n) => !n.resolved_at).map((n) => n.id)), [notes]);

  const view = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { doc } = editor.state;
      const quote = ({ from, to }: { from: number; to: number }) => noteQuote(doc.textBetween(from, to, " ", " "));
      const draft = noteDraft(editor.state);
      if (draft) return { key: DRAFT, quote: quote(draft), siblings: [] };
      const range = active ? noteRanges(doc).get(active) : undefined;
      if (!active || !range) return null;
      const siblings = markerGroups(doc, openIds).find((g) => g.ids.includes(active))?.ids ?? [active];
      return { key: active, quote: quote(range), siblings };
    },
  });
  const key = view?.key ?? null;
  const writing = key === DRAFT;

  const measure = useCallback(() => {
    const origin = layer.current!.getBoundingClientRect();
    const dom = editor.view.dom;
    const anchor =
      key === DRAFT
        ? [...dom.querySelectorAll(`.${styles.draft}`)].at(-1)
        : (dom.querySelector(`[data-note-marker~="${key}"]`) ?? dom.querySelector(`.${noteClass(key!)}`));
    const at = anchor && [...anchor.getClientRects()].at(-1);
    if (!at) return null;
    const width = panel.current?.offsetWidth ?? 0;
    const left = Math.min(at.right - origin.left - width, origin.width - width);
    return { top: Math.round(at.bottom - origin.top + POPOVER_GAP), left: Math.round(Math.max(0, left)) };
  }, [editor, layer, key]);
  const place = useMeasure(roots, key ? measure : null, NOT_ANCHORED);

  const dismiss = useDismiss(!!key && !writing, () => setActive(null), {
    root: panel,
    returnTo: () => editor.view.dom,
    // The editor's own click handling moves between Notes, or closes on plain text.
    ignoreOutside: (target) => editor.view.dom.contains(target),
  });

  if (!view) return null;
  const note = writing ? null : notes.find((n) => n.id === view.key);
  if (!writing && !note) return null;
  const at = view.siblings.indexOf(view.key);

  return (
    <div
      ref={panel}
      className={styles.popover}
      role="dialog"
      aria-label={writing ? "New Note" : "Note"}
      data-unplaced={place ? undefined : ""}
      style={place ? ({ "--at-top": `${place.top}px`, "--at-left": `${place.left}px` } as React.CSSProperties) : undefined}
    >
      {note && (
        <div className={styles.popoverHead}>
          {view.siblings.length > 1 && (
            <>
              <button
                type="button"
                className={styles.step}
                disabled={at <= 0}
                onClick={() => setActive(view.siblings[at - 1]!)}
                aria-label="Previous Note"
              >
                &lsaquo;
              </button>
              <span className={styles.stepCount}>
                {at + 1} of {view.siblings.length}
              </span>
              <button
                type="button"
                className={styles.step}
                disabled={at >= view.siblings.length - 1}
                onClick={() => setActive(view.siblings[at + 1]!)}
                aria-label="Next Note"
              >
                &rsaquo;
              </button>
            </>
          )}
          <button
            type="button"
            className={`${styles.step} ${styles.popoverClose}`}
            onClick={() => dismiss(true)}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      )}
      {note ? (
        <NoteCard
          note={note}
          quote={view.quote}
          replies={replies.filter((r) => r.note_id === note.id)}
          active
          onActivate={() => {}}
          onDeactivate={() => dismiss(true)}
        />
      ) : (
        <DraftCard quote={view.quote} onPosted={() => editor.commands.focus()} />
      )}
    </div>
  );
}

function DraftCard({
  ref,
  style,
  quote,
  onPosted,
}: {
  ref?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  quote: string;
  onPosted?: () => void;
}) {
  const { addNote, cancelDraft } = useNotes()!;

  return (
    <div ref={ref} className={styles.card} data-active style={style}>
      <blockquote className={styles.quote}>{quote}</blockquote>
      <Compose
        placeholder="Add a Note…"
        submit="Note"
        onSubmit={async (body) => {
          const result = await addNote(body);
          if (!result) onPosted?.();
          return result;
        }}
        onCancel={cancelDraft}
        autoFocus
      />
    </div>
  );
}

/**
 * A Note's thread. Active, it can be replied to and Resolved; a Resolved one can only be Reopened. A
 * `detached` Note's passage is gone from its document, so it shows the quote it was written on, struck out.
 */
export function NoteCard({
  ref,
  style,
  note,
  quote,
  replies,
  active,
  detached = false,
  onActivate,
  onDeactivate,
}: {
  ref?: React.Ref<HTMLDivElement>;
  style?: React.CSSProperties;
  note: Note;
  quote: string;
  replies: NoteReply[];
  active: boolean;
  detached?: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const { readOnly, reply, setResolved, person } = useNotes()!;
  const [error, setError] = useState<string | null>(null);
  const resolved = !!note.resolved_at;

  return (
    <div
      ref={ref}
      className={styles.card}
      data-active={active || undefined}
      style={style}
      role={active ? undefined : "button"}
      tabIndex={active ? undefined : 0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.defaultPrevented) return;
        // In a popover, or with its menu open, the layer's Escape (useDismiss).
        if (e.key === "Escape" && active && !hasOpenLayer()) {
          e.preventDefault();
          onDeactivate();
        } else if ((e.key === "Enter" || e.key === " ") && !active && e.target === e.currentTarget) {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {detached && <span className={styles.detached}>Passage removed</span>}
      <blockquote className={styles.quote} data-detached={detached || undefined}>
        {quote}
      </blockquote>
      <Message kind="note" message={note} active={active && !resolved} />
      {replies.length > 0 && (
        <ol className={styles.replies}>
          {replies.map((r) => (
            <li key={r.id}>
              <Message kind="reply" message={r} active={active && !resolved} />
            </li>
          ))}
        </ol>
      )}
      {resolved && (
        <p className={styles.resolvedBy}>
          Resolved by {person(note.resolved_by).name}, {relativeTime(Date.parse(note.resolved_at!))}
        </p>
      )}
      {active && !readOnly && resolved && (
        <button
          type="button"
          className={`button button-ghost button-tiny ${styles.reopen}`}
          onClick={async () => setError(await setResolved(note.id, false))}
        >
          Reopen
        </button>
      )}
      {active && !readOnly && !resolved && (
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
  const lookup = usePeople(NO_IDS);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who = person(message.author_id);
  const editable = !readOnly && isMine(message.author_id);
  const deletable = canDelete(message.author_id);

  async function onDelete() {
    setDeleting(false);
    setError(await remove(kind, message.id));
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
                <button type="button" className="menu-item" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              {deletable && (
                <button
                  type="button"
                  className="menu-item menu-item-danger"
                  data-close
                  onClick={() => setDeleting(true)}
                >
                  Delete
                </button>
              )}
            </Dropdown>
          )}
          <ConfirmDialog
            open={deleting}
            onCancel={() => setDeleting(false)}
            onConfirm={() => void onDelete()}
            title={kind === "note" ? "Delete this Note and its replies?" : "Delete this reply?"}
            action="Delete"
            danger
          />
        </div>
        {editing ? (
          <Compose
            initial={toEditableText(message.body, (id) => lookup(id)?.name ?? "someone")}
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
          <p className={styles.body}>
            <WriterMentionText body={message.body} />
          </p>
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

/**
 * A Note, reply or edit box. Enter sends, Shift+Enter starts a new line, Escape cancels. Typed `@username`s
 * of members are sent as Writer Mentions.
 */
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
  const { members } = useStoryMembers();
  const picker = useWriterMentionPicker(body, setBody);

  async function send() {
    if (!body.trim() || pending) return;
    setPending(true);
    const result = await onSubmit(toStoredBody(body, members));
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
      <WriterMentionPicker picker={picker}>
        <textarea
          {...picker.textareaProps}
          className={`input ${styles.input}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder ?? "Message"}
          maxLength={NOTE_BODY_MAX}
          rows={1}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (picker.onKeyDown(e)) return;
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            } else if (e.key === "Escape" && onCancel) {
              e.preventDefault();
              onCancel();
            }
          }}
        />
      </WriterMentionPicker>
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
