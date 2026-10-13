"use client";

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import { Extension, type Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Plugin, PluginKey, TextSelection, type Command, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { scriptEnter, scriptTab } from "@coscribe/editor";
import { getStoryCues } from "@/lib/actions/search";
import { cueOptions, type CueOption, type UsedCue } from "@/lib/cues";
import { useMeasure } from "@/lib/use-measure";
import { entryMentionKey } from "./EntryMentions";
import styles from "./CueSuggestions.module.css";

/** `used` is null until the Story's other Chapters have been asked. `dismissed` is the line Escape closed the list on. */
type CueState = { used: UsedCue[] | null; dismissed: number | null; active: { key: string; index: number } };

type CueMeta = { used: UsedCue[] } | { dismissed: number } | { active: { key: string; index: number } };

const cueKey = new PluginKey<CueState>("cueSuggestions");

type CueMenu = { line: number; key: string; options: CueOption[]; active: number };

/**
 * Suggests Character cues while the caret is in a Character line with text before it. Arrows move, Enter
 * (or Tab) puts the pick on the line and then does what that key does at a line's end, and Escape closes
 * the list until the caret leaves the line. Render CueSuggestionList for the list.
 */
export const CueSuggestions = Extension.create({
  name: "cueSuggestions",
  // Before the Script keymap.
  priority: 120,

  addProseMirrorPlugins() {
    return [
      new Plugin<CueState>({
        key: cueKey,
        state: {
          init: () => ({ used: null, dismissed: null, active: { key: "", index: 0 } }),
          apply(tr, prev) {
            const meta = tr.getMeta(cueKey) as CueMeta | undefined;
            const next = meta ? { ...prev, ...meta } : prev;
            if (next.dismissed === null) return next;
            const dismissed = tr.mapping.map(next.dismissed);
            const { $from } = tr.selection;
            const stays = $from.parent.type.name === "scriptElement" && $from.before() === dismissed;
            return { ...next, dismissed: stays ? dismissed : null };
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    const view = () => this.editor.view;
    const move = (by: number) => () => {
      const menu = this.editor.isEditable && cueMenu(this.editor.state);
      if (!menu) return false;
      const index = (menu.active + by + menu.options.length) % menu.options.length;
      setMeta(view(), { active: { key: menu.key, index } });
      return true;
    };
    const accept = (then: Command) => () => {
      const menu = this.editor.isEditable && cueMenu(this.editor.state);
      if (!menu) return false;
      acceptCue(view(), menu, menu.options[menu.active]!.cue, then);
      return true;
    };
    return {
      ArrowDown: move(1),
      ArrowUp: move(-1),
      Enter: accept(scriptEnter),
      Tab: accept(scriptTab),
      Escape: () => {
        const menu = this.editor.isEditable && cueMenu(this.editor.state);
        if (!menu) return false;
        setMeta(view(), { dismissed: menu.line });
        return true;
      },
    };
  },
});

function setMeta(view: EditorView, meta: CueMeta) {
  view.dispatch(view.state.tr.setMeta(cueKey, meta));
}

/** The list for the Character line holding the caret, or null when it has nothing to offer. */
function cueMenu(state: EditorState): CueMenu | null {
  const cues = cueKey.getState(state);
  const { selection } = state;
  const { $from } = selection;
  const line = $from.parent;
  if (!cues || !selection.empty || line.type.name !== "scriptElement" || line.attrs.element !== "character") return null;
  const linePos = $from.before();
  if (cues.dismissed === linePos) return null;
  const query = line.textBetween(0, $from.parentOffset).trimStart();
  if (!query.trim()) return null;

  const characters = (entryMentionKey.getState(state)?.entries ?? []).filter((e) => e.type === "character");
  const options = cueOptions(query, characters, [...docCues(state, linePos), ...(cues.used ?? [])]);
  if (!options.length) return null;
  const key = `${linePos}:${query}`;
  const active = cues.active.key === key ? Math.min(cues.active.index, options.length - 1) : 0;
  return { line: linePos, key, options, active };
}

/** The open Chapter's other Character lines. */
function docCues(state: EditorState, skip: number): UsedCue[] {
  const cues: UsedCue[] = [];
  state.doc.forEach((block, offset) => {
    if (block.type.name !== "script") return;
    block.forEach((line, at) => {
      const pos = offset + 1 + at;
      const cue = line.textContent.trim();
      if (pos !== skip && line.attrs.element === "character" && cue) cues.push({ cue, chapter: null });
    });
  });
  return cues;
}

function acceptCue(view: EditorView, menu: CueMenu, cue: string, then: Command) {
  const line = view.state.doc.nodeAt(menu.line)!;
  const start = menu.line + 1;
  const tr = view.state.tr.replaceWith(start, start + line.content.size, view.state.schema.text(cue));
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, start + cue.length)));
  then(view.state, view.dispatch);
}

const NOT_PLACED: { top: number; left: number; above: boolean } | null = null;
const GAP = 4;
/** Room the list wants; with less below, it goes above if there's more room there. */
const LIST_ROOM = 220;

/**
 * Laid over the Authorship box: the cue list under the Character line being typed. Fetches the cues used in
 * the Story's other Chapters the first time it opens.
 */
export function CueSuggestionList({ editor, storyId, chapterId }: { editor: Editor; storyId: string; chapterId: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const roots = useMemo(() => [layer], []);
  const listId = useId();
  const asked = useRef(false);

  const menu = useEditorState({
    editor,
    selector: ({ editor }) => (editor.isFocused && editor.isEditable ? cueMenu(editor.state) : null),
  });
  const open = !!menu;

  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    void getStoryCues(storyId).then((chapters) => {
      if (editor.isDestroyed) return;
      const used = chapters
        .filter((c) => c.chapterId !== chapterId)
        .flatMap((c) => c.cues.map((cue) => ({ cue, chapter: c.title })));
      setMeta(editor.view, { used });
    });
  }, [open, editor, storyId, chapterId]);

  const line = menu?.line;
  const measure = useCallback(() => {
    const origin = layer.current!.getBoundingClientRect();
    const at = editor.view.coordsAtPos(Math.min(line! + 1, editor.state.doc.content.size));
    const above = window.innerHeight - at.bottom < LIST_ROOM && at.top > window.innerHeight - at.bottom;
    return { top: Math.round((above ? at.top - GAP : at.bottom + GAP) - origin.top), left: Math.round(at.left - origin.left), above };
  }, [editor, line]);
  const place = useMeasure(roots, line === undefined ? null : measure, NOT_PLACED);

  return (
    <div ref={layer} className={styles.layer}>
      {menu && place && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Character cues"
          className={styles.list}
          data-above={place.above || undefined}
          style={{ top: place.top, left: place.left }}
        >
          {menu.options.map((o, i) => (
            <li
              key={`${o.cue}:${o.note}`}
              role="option"
              aria-selected={i === menu.active}
              className={styles.option}
              // Keeps focus (and the caret) in the editor.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setMeta(editor.view, { active: { key: menu.key, index: i } })}
              onClick={() => acceptCue(editor.view, menu, o.cue, scriptEnter)}
            >
              <span className={styles.cue}>{o.cue}</span>
              {o.note && <span className={styles.note}>{o.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
