"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { joinNames, presentWriters, type PresenceRow, type PresentWriter } from "@/lib/presence";
import { AvatarStack, type AvatarPerson } from "./Avatar";

export type HereNow = PresentWriter & { person: AvatarPerson };

const PresenceContext = createContext<HereNow[]>([]);

const COLUMNS = "id, user_id, kind, document_id, connected_at";

/**
 * The Story's Writers who are here right now, except me, live from `story_presence`. It sits in the
 * Story layout so one subscription serves the overview and the desk. Writers who joined after the page
 * loaded show up once it reloads.
 */
export function StoryPresenceProvider({
  storyId,
  me,
  members,
  children,
}: {
  storyId: string;
  me: string | null;
  members: AvatarPerson[];
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<PresenceRow[]>([]);

  // Subscribe first and load once subscribed, so nothing that changes in between is missed.
  useEffect(() => {
    let live = true;
    const load = async () => {
      const { data } = await supabase.from("story_presence").select(COLUMNS).eq("story_id", storyId);
      if (live && data) setRows(data);
    };
    const channel = supabase
      .channel(`story-presence:${storyId}`)
      .on<PresenceRow>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "story_presence", filter: `story_id=eq.${storyId}` },
        ({ new: row }) => setRows((current) => [...current.filter((r) => r.id !== row.id), row])
      )
      // Realtime can't filter deletes or check them against RLS, so each brings only an id to match.
      .on<PresenceRow>("postgres_changes", { event: "DELETE", schema: "public", table: "story_presence" }, ({ old }) =>
        setRows((current) => current.filter((r) => r.id !== old.id))
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, storyId]);

  const here = useMemo(() => {
    const people = new Map(members.map((p) => [p.id, p]));
    return presentWriters(rows, me).flatMap((writer) => {
      const person = people.get(writer.userId);
      return person ? [{ ...writer, person }] : [];
    });
  }, [rows, members, me]);

  return <PresenceContext value={here}>{children}</PresenceContext>;
}

/** Empty outside a StoryPresenceProvider. */
export function useHereNow() {
  return useContext(PresenceContext);
}

/** Who's in one Chapter right now, for its row on the overview. */
export function ChapterPresence({ chapterId, className }: { chapterId: string; className?: string }) {
  const people = useHereNow()
    .filter((h) => h.documentId === chapterId)
    .map((h) => h.person);
  if (!people.length) return null;

  return (
    <span className={className}>
      <AvatarStack people={people} size="sm" />
      {joinNames(people.map((p) => p.name))} {people.length === 1 ? "is" : "are"} here now
    </span>
  );
}
