"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StoryAuthor } from "./LiveDocument";

/** `member` is false for someone who has left the Story; their color is their profile's then. */
export type StoryPerson = StoryAuthor & { member: boolean };

type MembersValue = {
  me: string | null;
  members: StoryAuthor[];
  /** Undefined until fetched; null once their account is gone. */
  lookup: (id: string) => StoryPerson | null | undefined;
  request: (ids: string[]) => void;
};

const MembersContext = createContext<MembersValue | null>(null);

/**
 * The Story's Writers as of page load, for the whole Story layout. Anyone else a page needs (a Writer who
 * joined since, or one who has left) is fetched on first use.
 */
export function StoryMembersProvider({
  storyId,
  me,
  members,
  children,
}: {
  storyId: string;
  me: string | null;
  members: StoryAuthor[];
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [others, setOthers] = useState(() => new Map<string, StoryPerson | null>());
  const requested = useRef(new Set<string>());
  const byId = useMemo(() => new Map(members.map((m) => [m.id, { ...m, member: true }])), [members]);

  const lookup = useCallback((id: string) => byId.get(id) ?? others.get(id), [byId, others]);

  const request = useCallback(
    (ids: string[]) => {
      const missing = ids.filter((id) => !byId.has(id) && !requested.current.has(id));
      if (!missing.length) return;
      for (const id of missing) requested.current.add(id);
      void supabase
        .from("profiles")
        .select("id, username, author_color, story_members (author_color)")
        .eq("story_members.story_id", storyId)
        .in("id", missing)
        .then(({ data, error }) => {
          if (error) {
            for (const id of missing) requested.current.delete(id);
            return;
          }
          const found = data.map(({ id, username, author_color, story_members }) => ({
            id,
            name: username,
            color: story_members[0]?.author_color ?? author_color,
            member: story_members.length > 0,
          }));
          setOthers((current) => {
            const next = new Map(current);
            for (const id of missing) next.set(id, null);
            for (const p of found) next.set(p.id, p);
            return next;
          });
        });
    },
    [supabase, storyId, byId]
  );

  const value = useMemo(() => ({ me, members, lookup, request }), [me, members, lookup, request]);
  return <MembersContext value={value}>{children}</MembersContext>;
}

function useMembersContext() {
  const value = useContext(MembersContext);
  if (!value) throw new Error("Needs a StoryMembersProvider");
  return value;
}

export function useStoryMembers() {
  const { me, members } = useMembersContext();
  return { me, members };
}

/** Looks each up, fetching any who aren't current members. */
export function usePeople(ids: string[]) {
  const { lookup, request } = useMembersContext();
  const key = ids.join(" ");
  useEffect(() => {
    if (key) request(key.split(" "));
  }, [key, request]);
  return lookup;
}

export function usePerson(id: string) {
  return usePeople([id])(id);
}
