"use client";

import { useSelectedLayoutSegment } from "next/navigation";

/** Renders its children everywhere in a Story except the Reader and the print page. */
export function OutsideReader({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  return segment === "read" || segment === "print" ? null : children;
}
