"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SETTLE_MS = 300;

/**
 * Re-renders the Story's pages when someone else adds, renames, reorders or locks a Chapter, edits the
 * Story Bible, or changes members or settings (see `story_changes`). Live text and presence have their
 * own channels; this only refreshes server-rendered data.
 */
export function StoryUpdates({ storyId }: { storyId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), SETTLE_MS);
    };
    const filter = `story_id=eq.${storyId}`;
    const channel = supabase
      .channel(`story-changes:${storyId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_changes", filter }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "story_changes", filter }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router, storyId]);

  return null;
}
