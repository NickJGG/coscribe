"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { hasOpenLayer } from "@/lib/layers";
import { useDeskScroll } from "../DeskScroll";
import { HeadphonesIcon } from "../icons";
import { useNarration } from "./NarrationProvider";
import { deskSource, type DeskSource } from "./deskSource";

/** The Chapter a Desk document is, for Narration to announce; null for one it doesn't read. */
export type NarratedChapter = { number: number; title: string } | null;

/**
 * Narration of a Chapter open in the Desk, while it's on the page. While Listening, Escape stops it (and the find bar
 * stays open), and once it's over a Writer's caret lands where it stopped.
 */
export function useDeskNarration(editor: Editor | null, chapter: NarratedChapter, editable: boolean) {
  const narration = useNarration();
  const { attach, stop } = narration;
  const scroll = useDeskScroll();
  const number = chapter?.number;
  const title = chapter?.title;

  const source = useMemo<DeskSource | null>(
    () =>
      editor && number !== undefined && title !== undefined
        ? deskSource({ editor, number, title, scroll })
        : null,
    [editor, number, title, scroll]
  );

  useEffect(() => (source ? attach(source) : undefined), [attach, source]);

  const listening = !!source && narration.active === source;

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || hasOpenLayer()) return;
      e.preventDefault();
      stop();
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [listening, stop]);

  const was = useRef(false);
  useEffect(() => {
    if (listening) {
      was.current = true;
      return;
    }
    if (!was.current) return;
    was.current = false;
    if (!source || !editor || editor.isDestroyed || !editable) return;
    const pos = source.stoppedAt();
    if (pos !== null) editor.commands.focus(pos, { scrollIntoView: false });
  }, [listening, source, editor, editable]);

  return { source, listening, stop };
}

/** The Desk's Listen button, in the toolbar row: icon-only on phones, greyed where the browser can't read aloud. */
export function DeskListen({ source, listening }: { source: DeskSource | null; listening: boolean }) {
  const narration = useNarration();
  const unsupported = narration.support !== "ok";
  return (
    <button
      type="button"
      className="button button-ghost button-tiny with-icon"
      aria-pressed={unsupported ? undefined : listening}
      aria-disabled={unsupported || !source ? "true" : undefined}
      data-tip={narration.support === "none" ? "This browser can't read aloud" : "Listen"}
      onClick={() => {
        if (unsupported || !source) return;
        if (listening) narration.stop();
        else narration.start(source);
      }}
    >
      <HeadphonesIcon />
      <span className="with-icon-label">Listen</span>
    </button>
  );
}
