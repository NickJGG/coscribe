"use client";

import { createContext, useContext, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { COLLAPSED_COOKIE, sidebarCookie, WIDTH_COOKIE } from "@/lib/desk-sidebar";
import { ArrivalContext, type Arrival } from "@/components/DeskArrival";
import { useDismiss } from "@/components/useDismiss";

export type SidebarTab = "chapters" | "bible";

type Frame = {
  /** Desktop only: shrunk to the strip. Mid-size screens always start from the strip. */
  collapsed: boolean;
  /** Below desktop width: the full sidebar is open over the text (or as a sheet on phones). */
  overlay: boolean;
  /** Desktop only: the dragged width in px, or `null` for the 16rem default. CSS clamps it to the screen. */
  width: number | null;
  setWidth: (px: number | null) => void;
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
  open: (tab?: SidebarTab) => void;
  toggle: () => void;
  /** Closes the overlay; `refocus` returns focus to whatever opened it. */
  close: (refocus?: boolean) => void;
  /** Keeps an open overlay open on `path`, for navigation the overlay itself starts (typing a search). */
  keepOverlay: (path: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  /** Opens the sidebar and puts the caret in Story search. */
  focusSearch: () => void;
  /** True from `focusSearch` until the search box has focus, so opening the overlay leaves focus to it. */
  focusingSearch: React.RefObject<boolean>;
  sidebarRef: React.RefObject<HTMLElement | null>;
  arrivalRef: Arrival;
};

const FrameContext = createContext<Frame | null>(null);

const WIDE = "(min-width: 1025px)";
/** Where collapse was kept before it moved to a cookie. */
const LEGACY_COLLAPSED_KEY = "coscribe:sidebar-collapsed";
/** The header and main column, while the overlay is open over them. */
function setInert(desk: HTMLElement | null, on: boolean) {
  desk?.querySelectorAll<HTMLElement>("[data-desk-inert]").forEach((el) => (el.inert = on));
}
function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * The desk's sidebar state, shared by the sidebar and the breadcrumb that opens it on phones. Ctrl+\
 * collapses or opens the sidebar; "/" focuses Story search.
 */
export function DeskFrame({
  className,
  initialWidth,
  initialCollapsed,
  children,
}: {
  className?: string;
  initialWidth: number | null;
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { entryId } = useParams<{ entryId?: string }>();
  const [collapsed, setCollapsedState] = useState(initialCollapsed);
  const [width, setWidthState] = useState(initialWidth);
  // Tying these to the page they were set on resets them on navigation without an effect.
  const [overlayOn, setOverlayOn] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{ on: string; tab: SidebarTab } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusingSearch = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const arrivalRef: Arrival = useRef(null);

  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    document.cookie = sidebarCookie(COLLAPSED_COOKIE, next ? "1" : null);
  };
  const setWidth = (px: number | null) => {
    setWidthState(px);
    document.cookie = sidebarCookie(WIDTH_COOKIE, px === null ? null : String(px));
  };

  const overlay = overlayOn === pathname;
  const tab = chosen?.on === pathname ? chosen.tab : entryId ? "bible" : "chapters";

  useLayoutEffect(() => setInert(deskRef.current, overlay), [overlay]);

  const dismiss = useDismiss(
    overlay,
    () => {
      // At once rather than in the effect, so focus can go straight back to the breadcrumb in the header.
      setInert(deskRef.current, false);
      setOverlayOn(null);
    },
    {
      root: sidebarRef,
      returnTo: () => (opener.current instanceof HTMLElement && opener.current.isConnected ? opener.current : null),
      // The scrim's own click closes it, and returns focus as well.
      ignoreOutside: (target) => target instanceof Element && target.hasAttribute("data-scrim"),
    }
  );

  const openOverlay = () => {
    if (!overlay) opener.current = document.activeElement;
    setOverlayOn(pathname);
  };
  const setTab = (next: SidebarTab) => setChosen({ on: pathname, tab: next });
  const open = (next?: SidebarTab) => {
    if (next) setTab(next);
    if (matchMedia(WIDE).matches) setCollapsed(false);
    else openOverlay();
  };
  const toggle = () => {
    if (matchMedia(WIDE).matches) setCollapsed(!collapsed);
    else if (overlay) dismiss(true);
    else openOverlay();
  };
  const close = (refocus = false) => dismiss(refocus);
  const keepOverlay = (path: string) => {
    if (overlay) setOverlayOn(path);
  };
  const focusSearch = () => {
    focusingSearch.current = true;
    open();
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      focusingSearch.current = false;
    });
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "\\" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggle();
    } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
      e.preventDefault();
      focusSearch();
    }
  });

  useEffect(() => {
    try {
      if (localStorage.getItem(LEGACY_COLLAPSED_KEY) === null) return;
      const legacy = localStorage.getItem(LEGACY_COLLAPSED_KEY) === "1";
      localStorage.removeItem(LEGACY_COLLAPSED_KEY);
      if (legacy && !document.cookie.split("; ").some((c) => c.startsWith(`${COLLAPSED_COOKIE}=`))) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time migration from localStorage
        setCollapsedState(true);
        document.cookie = sidebarCookie(COLLAPSED_COOKIE, "1");
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <FrameContext
      value={{
        collapsed,
        overlay,
        width,
        setWidth,
        tab,
        setTab,
        open,
        toggle,
        close,
        keepOverlay,
        searchRef,
        focusSearch,
        focusingSearch,
        sidebarRef,
        arrivalRef,
      }}
    >
      <ArrivalContext value={arrivalRef}>
        <div
          ref={deskRef}
          className={className}
          data-desk
          data-collapsed={collapsed || undefined}
          data-overlay={overlay || undefined}
          style={width ? ({ "--sidebar-width": `${width}px` } as React.CSSProperties) : undefined}
        >
          {children}
        </div>
      </ArrivalContext>
    </FrameContext>
  );
}

export function useDeskFrame() {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error("useDeskFrame needs a DeskFrame");
  return frame;
}
