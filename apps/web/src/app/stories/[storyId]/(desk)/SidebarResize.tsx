"use client";

import { useEffect, useRef, useState } from "react";
import { SIDEBAR_MIN_PX, SIDEBAR_STEP_PX } from "@/lib/desk-sidebar";
import { useDeskFrame } from "./DeskFrame";
import styles from "./desk.module.css";

/**
 * The handle on the docked sidebar's right edge: drag or ←/→ to widen it, double-click to reset. While it
 * moves, `--sidebar-width` is written straight onto the desk; the width CSS actually renders (never past
 * the screen's cap) is what's kept.
 */
export function SidebarResize({ fullRef }: { fullRef: React.RefObject<HTMLDivElement | null> }) {
  const { setWidth } = useDeskFrame();
  const handle = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const [now, setNow] = useState(SIDEBAR_MIN_PX);

  useEffect(() => {
    const full = fullRef.current;
    if (!full) return;
    // Collapsed, it measures 0.
    const observer = new ResizeObserver(() => {
      const rendered = Math.round(full.getBoundingClientRect().width);
      if (rendered) setNow(rendered);
    });
    observer.observe(full);
    return () => observer.disconnect();
  }, [fullRef]);

  const desk = () => handle.current?.closest<HTMLElement>("[data-desk]") ?? null;
  const measure = () => Math.round(fullRef.current?.getBoundingClientRect().width ?? 0);
  const preview = (px: number) => desk()?.style.setProperty("--sidebar-width", `${Math.max(SIDEBAR_MIN_PX, px)}px`);
  // Set directly too: React leaves the style alone when the committed width matches what it last rendered.
  const commit = (px: number | null) => {
    if (px === null) desk()?.style.removeProperty("--sidebar-width");
    else preview(px);
    setWidth(px);
  };

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.removeAttribute("data-dragging");
    desk()?.removeAttribute("data-resizing");
    commit(measure());
  };

  return (
    <div
      ref={handle}
      className={styles.resize}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the sidebar"
      aria-valuenow={now}
      aria-valuemin={SIDEBAR_MIN_PX}
      tabIndex={0}
      data-tip="Drag to resize · Double-click to reset"
      data-side="right"
      data-follow
      data-delay
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { startX: e.clientX, startWidth: measure() };
        e.currentTarget.setAttribute("data-dragging", "");
        desk()?.setAttribute("data-resizing", "");
      }}
      onPointerMove={(e) => {
        if (drag.current) preview(drag.current.startWidth + e.clientX - drag.current.startX);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => commit(null)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        preview(measure() + (e.key === "ArrowRight" ? SIDEBAR_STEP_PX : -SIDEBAR_STEP_PX));
        requestAnimationFrame(() => commit(measure()));
      }}
    />
  );
}
