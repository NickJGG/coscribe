"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { entryNameAt, entryNamed } from "@coscribe/editor";
import { addEntryFromText } from "@/lib/actions/entries";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX, type EntryType, type EntryMentionEntry } from "@/lib/entries";
import { useMeasure } from "@/lib/use-measure";
import type { DocumentEntryMentions } from "./LiveDocument";
import { canAddNote, noteDraft } from "./notes/NoteHighlights";
import styles from "./SelectionActions.module.css";

const NOT_PLACED: { top: number; left: number } | null = null;
const POPOVER_GAP = 6;

type Adding = { name: string; to: number };

/**
 * Laid over the Authorship box: a pill over an editable selection offering "+ Note" (where `onAddNote` is
 * given) and "+ Bible" when the selection names something, or "Open Entry" when that name is already one.
 * "+ Bible" opens a popover to pick the new Entry's type, and the Writer stays put.
 */
export function SelectionActions({
  editor,
  entryMentions,
  onAddNote,
}: {
  editor: Editor;
  entryMentions?: DocumentEntryMentions;
  onAddNote?: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const roots = useMemo(() => [layer], []);
  const [adding, setAdding] = useState<Adding | null>(null);
  const bible = !!entryMentions;

  const offer = useEditorState({
    editor,
    selector: ({ editor }) => {
      const { state } = editor;
      const { from, to, $from, $to, empty } = state.selection;
      if (!editor.isFocused || !editor.isEditable || empty) return null;
      const note = !!onAddNote && canAddNote(editor) && !noteDraft(state);
      let name: string | null = null;
      if (bible && $from.parent === $to.parent && $from.parent.isTextblock) {
        const start = $from.start();
        name = entryNameAt($from.parent.textContent, from - start, to - start, NAME_MAX);
      }
      return note || name ? { from, to, note, name } : null;
    },
  });

  const measure = useCallback(() => {
    const origin = layer.current!.getBoundingClientRect();
    const at = editor.view.coordsAtPos(offer!.from);
    return { top: at.top - origin.top, left: at.left - origin.left };
  }, [editor, offer]);
  const place = useMeasure(roots, offer && !adding ? measure : null, NOT_PLACED);

  const existing = offer?.name && entryMentions ? entryNamed(offer.name, entryMentions.entries) : undefined;

  return (
    <div ref={layer} className={styles.layer}>
      {offer && place && !adding && (
        <div className={styles.pill} style={{ top: place.top, left: place.left }} onMouseDown={(e) => e.preventDefault()}>
          {offer.note && (
            <button type="button" onClick={onAddNote}>
              + Note
            </button>
          )}
          {offer.name &&
            entryMentions &&
            (existing ? (
              <Link href={`/stories/${entryMentions.storyId}/bible/${existing.id}`}>Open Entry</Link>
            ) : (
              <button type="button" onClick={() => setAdding({ name: offer.name!, to: offer.to })}>
                + Bible
              </button>
            ))}
        </div>
      )}
      {adding && entryMentions && (
        <BiblePopover
          editor={editor}
          layer={layer}
          storyId={entryMentions.storyId}
          entries={entryMentions.entries}
          adding={adding}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

/**
 * Names and types a new Entry from the selection, under it; a bottom sheet on phones. Picking a type adds
 * it (Enter picks Character). Escape or a click outside cancels.
 */
function BiblePopover({
  editor,
  layer,
  storyId,
  entries,
  adding,
  onClose,
}: {
  editor: Editor;
  layer: React.RefObject<HTMLDivElement | null>;
  storyId: string;
  entries: EntryMentionEntry[];
  adding: Adding;
  onClose: () => void;
}) {
  const panel = useRef<HTMLFormElement>(null);
  const prose = useMemo(() => ({ current: editor.view.dom }), [editor]);
  const roots = useMemo(() => [prose, layer], [prose, layer]);
  const [name, setName] = useState(adding.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const existing = entryNamed(name, entries);
  const { to } = adding;

  const measure = useCallback(() => {
    const origin = panel.current!.parentElement!.getBoundingClientRect();
    // Others may have shortened the text since the selection was taken.
    const at = editor.view.coordsAtPos(Math.min(to, editor.state.doc.content.size));
    const width = panel.current!.offsetWidth;
    const left = Math.min(at.left - origin.left, origin.width - width);
    return { top: Math.round(at.bottom - origin.top + POPOVER_GAP), left: Math.round(Math.max(0, left)) };
  }, [editor, to]);
  const place = useMeasure(roots, measure, NOT_PLACED);

  const cancel = useCallback(() => {
    onClose();
    editor.commands.focus();
  }, [editor, onClose]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) cancel();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [cancel, onClose]);

  function add(type: EntryType) {
    if (pending || existing || !name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addEntryFromText(storyId, name, type);
      if (result) return setError(result);
      onClose();
      editor.chain().focus().setTextSelection(Math.min(to, editor.state.doc.content.size)).run();
    });
  }

  return (
    <form
      ref={panel}
      className={styles.popover}
      role="dialog"
      aria-label="Add to Story Bible"
      data-unplaced={place ? undefined : ""}
      style={place ? ({ "--at-top": `${place.top}px`, "--at-left": `${place.left}px` } as React.CSSProperties) : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        add("character");
      }}
    >
      <span className="smallcaps muted">Add to Story Bible</span>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={NAME_MAX}
        aria-label="Entry name"
        autoFocus
        disabled={pending}
      />
      {existing ? (
        <p className={styles.existing}>
          Already in the Story Bible.{" "}
          <Link href={`/stories/${storyId}/bible/${existing.id}`}>Open Entry &rarr;</Link>
        </p>
      ) : (
        <div className={styles.types}>
          {ENTRY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className="button button-tiny"
              disabled={pending || !name.trim()}
              onClick={() => add(type)}
            >
              {ENTRY_TYPE_LABEL[type]}
            </button>
          ))}
        </div>
      )}
      {pending && <p className="muted">Adding…</p>}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </form>
  );
}
