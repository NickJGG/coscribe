"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import { fieldFragment, outlineExtensions, SmartPunctuation, type OutlineField as Field } from "@coscribe/editor";
import { useLocalSetting } from "@/lib/local-setting";
import { useSmartPunctuation } from "../SmartPunctuation";
import type { LiveSession } from "../SyncSocket";
import styles from "./outline.module.css";

export const NEW_FIELD = "New field";
const LABEL_MAX = 60;

/**
 * One Outline box, a small live editor on its own fragment of the Outline's document. Its label folds it
 * to its first line; folds are this browser's own, remembered per Chapter. An added field (one with
 * `onRename`) has a label to edit in place and a × to remove it, unless the Outline is read-only.
 */
export function OutlineField({
  chapterId,
  field,
  session,
  readOnly,
  onRename,
  onRemove,
  focusLabel = false,
}: {
  chapterId: string;
  field: Field;
  session: LiveSession;
  readOnly: boolean;
  onRename?: (label: string) => void;
  onRemove?: () => void;
  /** Focus the label with its text selected, for a field just added. */
  focusLabel?: boolean;
}) {
  const labelId = useId();
  const [folded, setFolded] = useLocalSetting(`coscribe:outline-fold:${chapterId}:${field.id}`, false);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...outlineExtensions,
      SmartPunctuation,
      Placeholder.configure({ placeholder: "Write here…" }),
      Collaboration.configure({ document: session.ydoc, field: fieldFragment(field.id) }),
    ],
    editorProps: { attributes: { class: styles.box, "aria-labelledby": labelId } },
  });
  const line = useEditorState({ editor, selector: ({ editor }) => (editor ? firstLine(editor.state.doc) : "") });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useSmartPunctuation(editor);

  const unfold = () => {
    setFolded(false);
    requestAnimationFrame(() => editor?.commands.focus());
  };

  const caret = (
    <span className={styles.caret} aria-hidden>
      {folded ? "▸" : "▾"}
    </span>
  );

  return (
    <section className={styles.field}>
      {onRename && !readOnly ? (
        <div className={styles.labelRow}>
          <button
            type="button"
            className={styles.label}
            aria-expanded={!folded}
            aria-label={`${folded ? "Unfold" : "Fold"} ${field.label}`}
            onClick={() => setFolded(!folded)}
          >
            {caret}
          </button>
          <LabelInput id={labelId} label={field.label} autoFocus={focusLabel} onRename={onRename} />
          {onRemove && (
            <button type="button" className={styles.remove} aria-label={`Remove ${field.label}`} onClick={onRemove}>
              &times;
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          id={labelId}
          className={styles.label}
          aria-expanded={!folded}
          onClick={() => setFolded(!folded)}
        >
          {caret}
          <span className="smallcaps">{field.label}</span>
        </button>
      )}
      {folded && (
        <button type="button" className={styles.folded} onClick={unfold} aria-label={`Unfold ${field.label}`}>
          {line || <span className={styles.foldedEmpty}>Empty</span>}
        </button>
      )}
      <div hidden={folded}>
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}

/** Shows the shared label until focused, then the draft; leaving or Enter saves it, Escape drops it. */
function LabelInput({
  id,
  label,
  autoFocus,
  onRename,
}: {
  id: string;
  label: string;
  autoFocus: boolean;
  onRename: (label: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  return (
    <input
      id={id}
      className={`smallcaps ${styles.labelInput}`}
      value={draft ?? label}
      aria-label="Field name"
      maxLength={LABEL_MAX}
      spellCheck={false}
      autoFocus={autoFocus}
      onFocus={(e) => {
        cancelled.current = false;
        setDraft(label);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={() => {
        if (!cancelled.current) onRename(draft?.trim() || NEW_FIELD);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          // Not the Modal's Escape: this one only cancels the rename.
          e.preventDefault();
          e.stopPropagation();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function firstLine(doc: ProseMirrorNode): string {
  let line = "";
  doc.descendants((node) => {
    if (line) return false;
    if (node.isTextblock) {
      line = node.textContent.trim();
      return false;
    }
  });
  return line;
}
