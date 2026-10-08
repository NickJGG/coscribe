import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import styles from "./notes.module.css";

export type NoteRange = { from: number; to: number };

/** Which Notes to highlight, which is active, and whether Show Notes is on. */
export type NoteHighlightConfig = { openIds: ReadonlySet<string>; activeId: string | null; show: boolean };

type NoteHighlightState = NoteHighlightConfig & { draft: NoteRange | null; set: DecorationSet };

/** A transaction's meta under `noteHighlightKey`: new config, and/or a draft range to start (or null to drop). */
export type NoteHighlightMeta = Partial<NoteHighlightConfig> & { draft?: NoteRange | null };

export const noteHighlightKey = new PluginKey<NoteHighlightState>("noteHighlights");

export type NoteHighlightOptions = { onActivate: (id: string | null) => void; onAddNote: () => void };

const NOTE_CLASS = "note-id-";

/** The class each highlighted span carries for its Note, so a click (or a scroll) can find it. */
export function noteClass(id: string) {
  return `${NOTE_CLASS}${id}`;
}

/**
 * Highlights open Notes' passages, and the passage of a Note being written, with decorations. The draft
 * range maps through every edit, so others typing meanwhile don't shift it; it's dropped if its text is
 * deleted. Clicking a highlight activates its Note (the next one, over overlapping Notes); clicking
 * plain text deactivates. Mod-Alt-M adds a Note on the selection.
 */
export const NoteHighlights = Extension.create<NoteHighlightOptions>({
  name: "noteHighlights",

  addOptions() {
    return { onActivate: () => {}, onAddNote: () => {} };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-m": () => {
        if (!canAddNote(this.editor)) return false;
        this.options.onAddNote();
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { onActivate } = this.options;
    return [
      new Plugin<NoteHighlightState>({
        key: noteHighlightKey,
        state: {
          init: () => ({ openIds: new Set(), activeId: null, show: true, draft: null, set: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(noteHighlightKey) as NoteHighlightMeta | undefined;
            if (!meta && !tr.docChanged) return prev;
            let draft = meta && "draft" in meta ? meta.draft! : prev.draft;
            if (draft && tr.docChanged) {
              const from = tr.mapping.map(draft.from, 1);
              const to = tr.mapping.map(draft.to, -1);
              draft = from < to ? { from, to } : null;
            }
            const next = { ...prev, ...meta, draft };
            return { ...next, set: decorate(tr.doc, next) };
          },
        },
        props: {
          decorations: (state) => noteHighlightKey.getState(state)?.set,
          // A DOM handler rather than handleClick, which read-only views (a Finished story) never call.
          handleDOMEvents: {
            click(view, event) {
              const state = noteHighlightKey.getState(view.state);
              if (!state) return false;
              const span = (event.target as Element).closest(`.${styles.highlight}`);
              const ids = [...(span?.classList ?? [])]
                .filter((c) => c.startsWith(NOTE_CLASS))
                .map((c) => c.slice(NOTE_CLASS.length));
              if (ids.length) {
                const at = ids.indexOf(state.activeId ?? "");
                onActivate(ids[(at + 1) % ids.length]!);
              } else if (state.activeId) {
                onActivate(null);
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});

function decorate(doc: ProseMirrorNode, { openIds, activeId, show, draft }: Omit<NoteHighlightState, "set">) {
  const decorations: Decoration[] = [];
  if (show && openIds.size) {
    doc.descendants((node, pos) => {
      if (!node.isText) return;
      for (const mark of node.marks) {
        const id = mark.attrs.id as unknown;
        if (mark.type.name !== "note" || typeof id !== "string" || !openIds.has(id)) continue;
        const active = id === activeId ? ` ${styles.active}` : "";
        const attrs = { class: `${styles.highlight}${active} ${noteClass(id)}` };
        decorations.push(Decoration.inline(pos, pos + node.nodeSize, attrs));
      }
    });
  }
  if (draft) decorations.push(Decoration.inline(draft.from, draft.to, { class: `${styles.highlight} ${styles.active}` }));
  return DecorationSet.create(doc, decorations);
}

export function noteDraft(state: EditorState): NoteRange | null {
  return noteHighlightKey.getState(state)?.draft ?? null;
}

/** A Note needs selected text, and an editor that can write its mark. */
export function canAddNote(editor: Editor): boolean {
  return editor.isEditable && !editor.state.selection.empty && editor.state.selection.content().content.size > 0;
}
