"use client";

import { createContext, useContext } from "react";

/**
 * A sidebar link followed from the Desk's overlay: the page it leads to, and where that page has put focus
 * so far. The page's own document takes focus over from there.
 */
export type Arrival = React.RefObject<{ path: string; focused: Element | null } | null>;

export const ArrivalContext = createContext<Arrival | null>(null);

/** `null` outside a desk. */
export function useArrival(): Arrival | null {
  return useContext(ArrivalContext);
}
