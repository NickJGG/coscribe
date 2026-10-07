"use client";

import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { useParams, usePathname } from "next/navigation";

export type SidebarTab = "chapters" | "bible";

type Frame = {
  /** Desktop only: shrunk to the strip. Mid-size screens always start from the strip. */
  collapsed: boolean;
  /** Below desktop width: the full sidebar is open over the text (or as a sheet on phones). */
  overlay: boolean;
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
  open: (tab?: SidebarTab) => void;
  toggle: () => void;
  close: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
};

const FrameContext = createContext<Frame | null>(null);

const WIDE = "(min-width: 1025px)";
const COLLAPSED_KEY = "coscribe:sidebar-collapsed";
const listeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(COLLAPSED_KEY, "1");
    else localStorage.removeItem(COLLAPSED_KEY);
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribeCollapsed(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * The desk's sidebar state, shared by the sidebar and the breadcrumb that opens it on phones. Ctrl+\
 * collapses or opens the sidebar; "/" opens the Bible tab's search.
 */
export function DeskFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { entryId } = useParams<{ entryId?: string }>();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  // Tying these to the page they were set on resets them on navigation without an effect.
  const [overlayOn, setOverlayOn] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ on: string; tab: SidebarTab } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const overlay = overlayOn === pathname;
  const tab = chosen?.on === pathname ? chosen.tab : entryId ? "bible" : "chapters";

  const setTab = (next: SidebarTab) => setChosen({ on: pathname, tab: next });
  const open = (next?: SidebarTab) => {
    if (next) setTab(next);
    if (matchMedia(WIDE).matches) writeCollapsed(false);
    else setOverlayOn(pathname);
  };
  const toggle = () => {
    if (matchMedia(WIDE).matches) writeCollapsed(!collapsed);
    else setOverlayOn(overlay ? null : pathname);
  };
  const close = () => setOverlayOn(null);

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "\\" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggle();
    } else if (e.key === "Escape" && overlay) {
      close();
    } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
      e.preventDefault();
      open("bible");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  });

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <FrameContext value={{ collapsed, overlay, tab, setTab, open, toggle, close, searchRef }}>
      <div
        className={className}
        data-desk
        data-collapsed={collapsed || undefined}
        data-overlay={overlay || undefined}
      >
        {children}
      </div>
    </FrameContext>
  );
}

export function useDeskFrame() {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error("useDeskFrame needs a DeskFrame");
  return frame;
}
