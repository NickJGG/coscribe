"use client";

import { useEffect, useId } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import { fieldFragment, outlineExtensions, type OutlineField as Field } from "@coscribe/editor";
import { useLocalSetting } from "@/lib/local-setting";
import type { LiveSession } from "../SyncSocket";
import styles from "./outline.module.css";

/**
 * One Outline box, a small live editor on its own fragment of the Outline's document. Its label folds it
 * to its first line; folds are this browser's own, remembered per Chapter.
 */
export function OutlineField({
  chapterId,
  field,
  session,
  readOnly,
}: {
  chapterId: string;
  field: Field;
  session: LiveSession;
  readOnly: boolean;
}) {
  const labelId = useId();
  const [folded, setFolded] = useLocalSetting(`coscribe:outline-fold:${chapterId}:${field.id}`, false);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...outlineExtensions,
      Placeholder.configure({ placeholder: "Write here…" }),
      Collaboration.configure({ document: session.ydoc, field: fieldFragment(field.id) }),
    ],
    editorProps: { attributes: { class: styles.box, "aria-labelledby": labelId } },
  });
  const line = useEditorState({ editor, selector: ({ editor }) => (editor ? firstLine(editor.state.doc) : "") });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const unfold = () => {
    setFolded(false);
    requestAnimationFrame(() => editor?.commands.focus());
  };

  return (
    <section className={styles.field}>
      <button
        type="button"
        id={labelId}
        className={styles.label}
        aria-expanded={!folded}
        onClick={() => setFolded(!folded)}
      >
        <span className={styles.caret} aria-hidden>
          {folded ? "▸" : "▾"}
        </span>
        <span className="smallcaps">{field.label}</span>
      </button>
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
