"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./Dropdown.module.css";

const OpenContext = createContext(false);

/** Whether the Dropdown around this content is open, for content that loads only when shown. */
export function useDropdownOpen() {
  return useContext(OpenContext);
}

/**
 * A button that opens a panel beneath it. Escape, a click outside, following a link inside, or navigating
 * closes it; Escape also returns focus to the button. Not an ARIA menu: panels hold forms and links.
 */
export function Dropdown({
  label,
  trigger,
  className,
  triggerClassName,
  panelClassName,
  align = "end",
  children,
}: {
  label: string;
  trigger: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Remembering where it opened closes it on navigation without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenOn(null);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${className ?? ""}`}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !e.currentTarget.contains(next)) setOpenOn(null);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenOn(open ? null : pathname)}
      >
        {trigger}
      </button>
      <div
        id={panelId}
        className={`${styles.panel} ${panelClassName ?? ""}`}
        data-align={align}
        role="region"
        aria-label={label}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as Element).closest("a")) setOpenOn(null);
        }}
      >
        <OpenContext value={open}>{children}</OpenContext>
      </div>
    </div>
  );
}
