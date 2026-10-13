"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./Dropdown.module.css";

const OpenContext = createContext(false);
const GAP = 8;

/** Whether the Dropdown around this content is open, for content that loads only when shown. */
export function useDropdownOpen() {
  return useContext(OpenContext);
}

/**
 * A button that opens a panel beneath it. Escape, a click outside, following a link or a `data-close`
 * button inside, or navigating closes it; Escape and `data-close` also return focus to the button. Not an ARIA menu: panels hold forms and links.
 * `fixed` pins the panel to the viewport, flipping above the button near the bottom, so a scrolling
 * container can't clip it; any scroll or resize closes it.
 */
export function Dropdown({
  label,
  tip,
  trigger,
  className,
  triggerClassName,
  panelClassName,
  align = "end",
  fixed = false,
  children,
}: {
  label: string;
  tip?: string;
  trigger: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  align?: "start" | "end";
  fixed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Remembering where it opened closes it on navigation without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!open || !fixed || !panel || !button) return;
    // Phones get the bottom sheet, and their keyboard opening fires resize.
    const sheet = () => matchMedia("(max-width: 600px)").matches;
    const place = () => {
      const at = button.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = panel;
      const below = innerHeight - at.bottom - GAP;
      const up = height > below && at.top - GAP > below;
      const top = up ? Math.max(GAP, at.top - GAP - height) : at.bottom + GAP;
      const left = align === "end" ? at.right - width : at.left;
      panel.style.setProperty("--fixed-top", `${top}px`);
      panel.style.setProperty("--fixed-left", `${Math.max(GAP, Math.min(left, innerWidth - width - GAP))}px`);
    };
    place();
    const resized = new ResizeObserver(place);
    resized.observe(panel);
    const onMove = (e: Event) => {
      if (sheet() || (e.target instanceof Node && panel.contains(e.target))) return;
      setOpenOn(null);
    };
    addEventListener("scroll", onMove, true);
    addEventListener("resize", onMove);
    return () => {
      resized.disconnect();
      removeEventListener("scroll", onMove, true);
      removeEventListener("resize", onMove);
    };
  }, [open, fixed, align]);

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${className ?? ""}`}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !e.currentTarget.contains(next)) setOpenOn(null);
      }}
      onKeyDown={(e) => {
        // Handled here too, so a Modal around it neither closes nor swallows this Escape.
        if (e.key !== "Escape" || !open) return;
        e.preventDefault();
        e.stopPropagation();
        setOpenOn(null);
        buttonRef.current?.focus();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        data-tip={tip}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenOn(open ? null : pathname)}
      >
        {trigger}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={`${styles.panel} ${panelClassName ?? ""}`}
        data-align={align}
        data-fixed={fixed || undefined}
        role="region"
        aria-label={label}
        hidden={!open}
        onClick={(e) => {
          const target = (e.target as Element).closest("a, [data-close]");
          if (!target) return;
          setOpenOn(null);
          if (target.tagName !== "A") buttonRef.current?.focus();
        }}
      >
        <OpenContext value={open}>{children}</OpenContext>
      </div>
    </div>
  );
}
