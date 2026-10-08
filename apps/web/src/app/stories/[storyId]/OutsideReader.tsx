"use client";

import { useSelectedLayoutSegment } from "next/navigation";

/** Renders its children everywhere in a Story except the Reader. */
export function OutsideReader({ children }: { children: React.ReactNode }) {
  return useSelectedLayoutSegment() === "read" ? null : children;
}
