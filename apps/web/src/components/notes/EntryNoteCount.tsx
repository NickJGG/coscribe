"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./notes.module.css";

/**
 * An embedded Entry body's open Notes, as a count that opens the Entry page with the Notes panel open.
 * Nothing at none, which is all a Viewer ever sees (the select policy hides Notes from them).
 */
export function EntryNoteCount({ storyId, entryId, className }: { storyId: string; entryId: string; className?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [count, setCount] = useState(0);
  const unique = useId();

  useEffect(() => {
    let live = true;
    const load = async () => {
      const { count } = await supabase
        .from("notes")
        .select("id", { count: "exact", head: true })
        .eq("entry_id", entryId)
        .is("resolved_at", null);
      if (live) setCount(count ?? 0);
    };
    const filter = `entry_id=eq.${entryId}`;
    // Pinned and Outline cards can show the same Entry at once, so each needs its own channel.
    const channel = supabase
      .channel(`entry-note-count:${entryId}:${unique}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notes", filter }, () => void load())
      // Realtime can't filter deletes.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notes" }, () => void load())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, entryId, unique]);

  if (!count) return null;
  return (
    <Link href={`/stories/${storyId}/bible/${entryId}?notes`} className={`${styles.entryCount} ${className ?? ""}`}>
      {count} {count === 1 ? "Note" : "Notes"}
      <span className="sr-only"> open</span>
    </Link>
  );
}
