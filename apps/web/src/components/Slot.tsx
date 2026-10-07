"use client";

import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

type SlotState = [HTMLElement | null, React.Dispatch<React.SetStateAction<HTMLElement | null>>];

/**
 * A place in a layout that a page further down fills, so a page's controls can sit in the layout's chrome
 * while their state stays with the page. Outside the Provider, `Fill` renders in place.
 */
export function createSlot() {
  const Context = createContext<SlotState | null>(null);

  function Provider({ children }: { children: React.ReactNode }) {
    const state = useState<HTMLElement | null>(null);
    return <Context value={state}>{children}</Context>;
  }

  function Target(props: Omit<React.ComponentProps<"div">, "ref">) {
    const [, setTarget] = useContext(Context) ?? [];
    return (
      <div
        {...props}
        ref={(el) => {
          if (!el || !setTarget) return;
          setTarget(el);
          // Only clear it if no newer Target has taken over, as when one layout replaces another.
          return () => setTarget((current) => (current === el ? null : current));
        }}
      />
    );
  }

  function Fill({ children }: { children: React.ReactNode }) {
    const slot = useContext(Context);
    if (!slot) return children;
    return slot[0] ? createPortal(children, slot[0]) : null;
  }

  /** The mounted Target, or null. */
  function useTarget() {
    return useContext(Context)?.[0] ?? null;
  }

  return { Provider, Target, Fill, useTarget };
}
