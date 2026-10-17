"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { MemberRole } from "@/lib/story-roles";
import type { Note, NoteReply } from "@/lib/notes";
import type { StoryAuthor } from "../LiveDocument";
import { useNoteThreads, type NoteThreadValue } from "./NoteThreads";

type StoryNotesValue = {
  notes: Note[];
  replies: NoteReply[];
  loaded: boolean;
  /** For the cards, inside a NoteThreadContext of their own. */
  thread: NoteThreadValue;
  /** Not Finished, so a Story Note can be started. */
  canAdd: boolean;
  /** A Story Note is being written in the Notes panel. */
  drafting: boolean;
  setDrafting: (drafting: boolean) => void;
  addStory: (body: string) => Promise<ActionResult>;
  /** The Story Note whose card is open in the Notes panel. */
  expanded: string | null;
  setExpanded: (id: string | null) => void;
};

const StoryNotesContext = createContext<StoryNotesValue | null>(null);

/** The Story's own Notes, or null for anyone below Writer. */
export function useStoryNotes() {
  return useContext(StoryNotesContext);
}

/**
 * Story Notes: Notes on the Story rather than a Chapter or Entry, for Writers and up. Mounted in the desk
 * layout, so one subscription serves the Overview and every Chapter's and Entry's Notes panel.
 */
export function StoryNotesProvider({
  storyId,
  me,
  myRole,
  authors,
  finished,
  children,
}: {
  storyId: string;
  me: string;
  myRole: MemberRole;
  authors: StoryAuthor[];
  finished: boolean;
  children: React.ReactNode;
}) {
  const scope = useMemo(() => ({ kind: "story" as const, id: storyId }), [storyId]);
  const { notes, replies, loaded, post, thread } = useNoteThreads({ scope, me, myRole, authors, finished });
  const [drafting, setDrafting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const addStory = useCallback(
    async (body: string): Promise<ActionResult> => {
      const result = await post(null, body);
      if (!result.id) return result.error;
      setDrafting(false);
      return null;
    },
    [post]
  );

  const value = useMemo<StoryNotesValue>(
    () => ({
      notes,
      replies,
      loaded,
      thread,
      canAdd: !finished,
      drafting,
      setDrafting,
      addStory,
      expanded,
      setExpanded,
    }),
    [notes, replies, loaded, thread, finished, drafting, addStory, expanded]
  );

  return <StoryNotesContext value={value}>{children}</StoryNotesContext>;
}
