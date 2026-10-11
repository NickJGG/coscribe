"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { joinNames, presentWriters, type PresenceRow, type PresentWriter } from "@/lib/presence";
import { authorColorCss } from "@/lib/profile-rules";
import type { AvatarPerson } from "./Avatar";
import styles from "./StoryPresence.module.css";

export type HereNow = PresentWriter & { person: AvatarPerson };

const PresenceContext = createContext<HereNow[]>([]);

const COLUMNS = "id, user_id, kind, document_id, connected_at";

/**
 * The Story's Writers who are here right now, except me, live from `story_presence`. It sits in the
 * Story layout so one subscription serves the whole Desk. Writers who joined after the page
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

/** Who's in one Chapter right now, as a dot each, for its row on the Overview. */
export function ChapterPresence({ chapterId, className }: { chapterId: string; className?: string }) {
  const here = useHereNow().filter((h) => h.documentId === chapterId);
  if (!here.length) return null;
  return <PresenceDots here={here} className={className} />;
}

export function PresenceDots({ here, className }: { here: HereNow[]; className?: string }) {
  return (
    <span className={`${styles.dots} ${className ?? ""}`}>
      {here.map((h) => (
        <span
          key={h.userId}
          className={styles.dot}
          style={{ "--c": authorColorCss(h.person.color) } as React.CSSProperties}
          data-tip={h.person.name}
          aria-hidden
        />
      ))}
      <span className="sr-only">{joinNames(here.map((h) => h.person.name))} here now</span>
    </span>
  );
}
