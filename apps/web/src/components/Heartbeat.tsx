"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const BEAT_MS = 60_000;

/**
 * Keeps `profiles.last_seen` fresh while this tab is visible: Friends see you Online for 2 minutes after.
 * Also sends the browser's time zone once, which decides the day each Writing Day falls on.
 */
export function Heartbeat() {
  useEffect(() => {
    const supabase = createClient();
    void supabase.rpc("set_time_zone", { p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const beat = () => void supabase.rpc("heartbeat");
    let timer: number | undefined;

    const follow = () => {
      clearInterval(timer);
      if (document.visibilityState !== "visible") return;
      beat();
      timer = window.setInterval(beat, BEAT_MS);
    };

    follow();
    document.addEventListener("visibilitychange", follow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", follow);
    };
  }, []);

  return null;
}
