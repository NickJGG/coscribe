"use client";

import { createContext, useContext, useEffect, useState } from "react";

/** The desk's scrolling page, which the open document can measure: its width is the room the page has. */
export const DeskScrollContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

export function useDeskScroll() {
  return useContext(DeskScrollContext);
}

/**
 * The narrowest page with its margins (chapter.module.css, entry.module.css): the text centered between two columns of a gap
 * and the narrowest cards, plus both gutters. Narrower, the text would have to move over to fit them.
 * desk.module.css caps the sidebar's width with the same numbers.
 */
const MARGIN_PAGE_REM = 40 + 2 * 15;
const MARGIN_PAGE_PX = 2 * 32 + 2 * 16;

/**
 * Whether the desk's page is narrower than the text and its margins of cards, as the sidebar and window change.
 * Null until measured.
 */
export function useNarrowDesk() {
  const scroll = useDeskScroll();
  const [narrow, setNarrow] = useState<boolean | null>(null);

  useEffect(() => {
    const el = scroll?.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      setNarrow(el.clientWidth < MARGIN_PAGE_REM * rem + MARGIN_PAGE_PX);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scroll]);

  return narrow;
}
