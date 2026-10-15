"use client";

import { useEffect } from "react";
import { markChangelogSeen } from "@/lib/actions/profile";

/** Opening the Changelog clears the You menu's dot. */
export function MarkChangelogSeen({ date }: { date: string }) {
  useEffect(() => {
    void markChangelogSeen(date);
  }, [date]);

  return null;
}
