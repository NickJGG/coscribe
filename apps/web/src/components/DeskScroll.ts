"use client";

import { createContext, useContext } from "react";

/** The desk's scrolling page, which the open document can measure: its width is the room the page has. */
export const DeskScrollContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

export function useDeskScroll() {
  return useContext(DeskScrollContext);
}
