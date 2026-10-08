"use client";

import { createContext, useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { useLocalSetting } from "@/lib/local-setting";

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
  /** Keeps an open overlay open on `path`, for navigation the overlay itself starts (typing a search). */
  keepOverlay: (path: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  /** Opens the sidebar and puts the caret in Story search. */
  focusSearch: () => void;
};

const FrameContext = createContext<Frame | null>(null);

const WIDE = "(min-width: 1025px)";
const COLLAPSED_KEY = "coscribe:sidebar-collapsed";
function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * The desk's sidebar state, shared by the sidebar and the breadcrumb that opens it on phones. Ctrl+\
 * collapses or opens the sidebar; "/" focuses Story search.
 */
export function DeskFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { entryId } = useParams<{ entryId?: string }>();
  const [collapsed, setCollapsed] = useLocalSetting(COLLAPSED_KEY, false);
  // Tying these to the page they were set on resets them on navigation without an effect.
  const [overlayOn, setOverlayOn] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ on: string; tab: SidebarTab } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const overlay = overlayOn === pathname;
  const tab = chosen?.on === pathname ? chosen.tab : entryId ? "bible" : "chapters";

  const setTab = (next: SidebarTab) => setChosen({ on: pathname, tab: next });
  const open = (next?: SidebarTab) => {
    if (next) setTab(next);
    if (matchMedia(WIDE).matches) setCollapsed(false);
    else setOverlayOn(pathname);
  };
  const toggle = () => {
    if (matchMedia(WIDE).matches) setCollapsed(!collapsed);
    else setOverlayOn(overlay ? null : pathname);
  };
  const close = () => setOverlayOn(null);
  const keepOverlay = (path: string) => {
    if (overlay) setOverlayOn(path);
  };
  const focusSearch = () => {
    open();
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "\\" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggle();
    } else if (e.key === "Escape" && overlay) {
      close();
    } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
      e.preventDefault();
      focusSearch();
    }
  });

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <FrameContext value={{ collapsed, overlay, tab, setTab, open, toggle, close, keepOverlay, searchRef, focusSearch }}>
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
