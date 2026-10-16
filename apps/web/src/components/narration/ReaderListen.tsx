"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import type { EntryMentionEntry } from "@/lib/entries";
import { HeadphonesIcon } from "../icons";
import { useNarration } from "./NarrationProvider";
import { readerSource } from "./readerSource";

/**
 * The Reader View's Listen button, for the Chapter rendered in `#textId`. At the Chapter's end Narration moves on to
 * `next`, and after the last one (no `next`) it says "The End." and opens `credits`.
 */
export function ReaderListen({
  storyId,
  content,
  number,
  title,
  characters,
  next,
  credits,
  textId,
}: {
  storyId: string;
  content: JSONContent;
  number: number;
  title: string;
  /** The Story's Character Entries, whose dialogue is read in their Voices. */
  characters: EntryMentionEntry[];
  next: string | null;
  credits: string;
  textId: string;
}) {
  const narration = useNarration();
  const { attach, start, stop } = narration;
  const router = useRouter();

  const source = useMemo(
    () =>
      readerSource({
        storyId,
        content,
        number,
        title,
        characters,
        last: !next,
        container: () => document.getElementById(textId),
        onEnd: () => {
          router.push(next ?? credits);
          return next !== null;
        },
      }),
    [storyId, content, number, title, characters, next, credits, textId, router]
  );

  useEffect(() => attach(source), [attach, source]);

  const listening = narration.active === source;
  if (narration.support !== "ok") {
    return (
      <button
        type="button"
        className="button button-ghost button-small with-icon"
        aria-disabled="true"
        data-tip={narration.support === "none" ? "This browser can't read aloud" : undefined}
      >
        <HeadphonesIcon />
        Listen
      </button>
    );
  }
  return (
    <button
      type="button"
      className="button button-ghost button-small with-icon"
      aria-pressed={listening}
      onClick={() => (listening ? stop() : start(source))}
    >
      <HeadphonesIcon />
      Listen
    </button>
  );
}
