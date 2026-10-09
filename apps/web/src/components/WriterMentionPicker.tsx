"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { typedMentionAt } from "@/lib/writer-mentions";
import { Avatar } from "./Avatar";
import { useStoryMembers } from "./StoryMembers";
import styles from "./WriterMentions.module.css";

const SHOWN = 6;
/** Room the list wants; with less below, it goes above if there's more room there. */
const LIST_ROOM = 200;

type Placement = "above" | "below";

/**
 * Suggests the Story's Writers for an `@query` typed just before the caret in a textarea. Spread
 * `textareaProps` on the textarea, run `onKeyDown` first in its own key handler (it returns true when it
 * took the key, overriding Enter-to-send and Escape-to-cancel while open), and wrap it in
 * WriterMentionPicker for the list.
 */
export function useWriterMentionPicker(value: string, setValue: (value: string) => void) {
  const { me, members } = useStoryMembers();
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [caret, setCaret] = useState<number | null>(null);
  const [highlight, setHighlight] = useState({ key: "", index: 0 });
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [placement, setPlacement] = useState<Placement>("below");

  const typed = caret === null ? null : typedMentionAt(value, caret);
  const key = typed ? `${typed.start}:${typed.query}` : "";
  const options =
    typed && key !== dismissed
      ? members
          .filter((m) => m.id !== me && m.name.toLowerCase().startsWith(typed.query.toLowerCase()))
          .slice(0, SHOWN)
      : [];
  const open = options.length > 0;
  const active = highlight.key === key ? Math.min(highlight.index, options.length - 1) : 0;
  const optionId = (i: number) => `${listId}-${i}`;

  useLayoutEffect(() => {
    if (open && ref.current) setPlacement(placeFor(ref.current));
  }, [open]);

  function pick(name: string) {
    if (!typed || caret === null) return;
    const before = `${value.slice(0, typed.start)}@${name} `;
    setValue(before + value.slice(caret));
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(before.length, before.length);
      setCaret(before.length);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!open || e.nativeEvent.isComposing) return false;
    const move = (by: number) => setHighlight({ key, index: (active + by + options.length) % options.length });
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter" || e.key === "Tab") pick(options[active]!.name);
    else if (e.key === "Escape") setDismissed(key);
    else return false;
    e.preventDefault();
    return true;
  }

  const textareaProps = {
    ref,
    role: "combobox",
    "aria-expanded": open,
    "aria-controls": listId,
    "aria-autocomplete": "list",
    "aria-activedescendant": open ? optionId(active) : undefined,
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart),
    onBlur: () => setCaret(null),
  } as const;

  const listbox = (
    <ul id={listId} role="listbox" aria-label="Writers" className={styles.list} data-placement={placement} hidden={!open}>
      {options.map((m, i) => (
        <li
          key={m.id}
          id={optionId(i)}
          role="option"
          aria-selected={i === active}
          className={styles.option}
          // Keeps focus (and the caret) in the textarea.
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setHighlight({ key, index: i })}
          onClick={() => pick(m.name)}
        >
          <Avatar name={m.name} color={m.color} size="sm" />
          {m.name}
        </li>
      ))}
    </ul>
  );

  return { textareaProps, onKeyDown, listbox };
}

export function WriterMentionPicker({
  picker,
  children,
}: {
  picker: ReturnType<typeof useWriterMentionPicker>;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.anchor}>
      {children}
      {picker.listbox}
    </div>
  );
}

/** Below unless the nearest box that clips (or the window) is short of room there and has more above. */
function placeFor(el: HTMLElement): Placement {
  let clip: { top: number; bottom: number } = { top: 0, bottom: window.innerHeight };
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflowY !== "visible") {
      clip = p.getBoundingClientRect();
      break;
    }
  }
  const rect = el.getBoundingClientRect();
  const above = rect.top - Math.max(clip.top, 0);
  const below = Math.min(clip.bottom, window.innerHeight) - rect.bottom;
  return below < LIST_ROOM && above > below ? "above" : "below";
}
