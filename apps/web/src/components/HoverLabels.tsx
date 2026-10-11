"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 450;
const TOUCH_LINGER_MS = 1500;
const GAP = 6;
const EDGE = 8;
const WRAP_AFTER = 40;

type Tip = { target: HTMLElement; text: string; keys: string | undefined };

/**
 * The app's one hover label, replacing the browser's `title` tooltips. Any element with `data-tip`
 * gets it, plus `data-keys` for a shortcut and `data-side="right"` to sit beside rather than below.
 * Shows instantly on mouse hover and keyboard focus, and on a long-press on touch, which swallows
 * the tap that follows. Stays quiet while the element is `aria-expanded`, so an open menu's own
 * button doesn't label over it.
 */
export function HoverLabels() {
  const [tip, setTip] = useState<Tip | null>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let press: number | undefined;
    let linger: number | undefined;
    let pressed = false;

    const tipOf = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tip]") : null);

    const hide = () => {
      clearTimeout(linger);
      if (!current) return;
      current = null;
      setTip(null);
    };

    const show = (target: HTMLElement) => {
      const text = target.dataset.tip;
      if (!text || target.getAttribute("aria-expanded") === "true") return hide();
      clearTimeout(linger);
      current = target;
      setTip({ target, text, keys: target.dataset.keys });
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = tipOf(e);
      if (target && target !== current) show(target);
    };

    const out = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !current) return;
      if (e.relatedTarget instanceof Node && current.contains(e.relatedTarget)) return;
      hide();
    };

    const down = (e: PointerEvent) => {
      hide();
      pressed = false;
      clearTimeout(press);
      if (e.pointerType !== "touch") return;
      const target = tipOf(e);
      if (!target) return;
      press = window.setTimeout(() => {
        pressed = true;
        show(target);
      }, LONG_PRESS_MS);
    };

    const up = () => {
      clearTimeout(press);
      if (pressed) linger = window.setTimeout(hide, TOUCH_LINGER_MS);
    };

    const click = (e: MouseEvent) => {
      if (!pressed) return hide();
      pressed = false;
      e.preventDefault();
      e.stopPropagation();
    };

    const contextMenu = (e: MouseEvent) => {
      if (pressed) e.preventDefault();
    };

    const focusIn = (e: FocusEvent) => {
      const target = tipOf(e);
      if (target && e.target instanceof Element && e.target.matches(":focus-visible")) show(target);
    };

    const focusOut = (e: FocusEvent) => {
      if (current && e.target instanceof Node && current.contains(e.target)) hide();
    };

    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    document.addEventListener("click", click, true);
    document.addEventListener("contextmenu", contextMenu, true);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("keydown", key, true);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      clearTimeout(press);
      clearTimeout(linger);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("contextmenu", contextMenu, true);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  useLayoutEffect(() => {
    const el = label.current;
    if (!tip || !el) return;
    const r = tip.target.getBoundingClientRect();
    const { width: w, height: h } = el.getBoundingClientRect();
    let left: number;
    let top: number;
    if (tip.target.dataset.side === "right") {
      left = r.right + GAP;
      top = r.top + (r.height - h) / 2;
    } else {
      left = r.left + (r.width - w) / 2;
      top = r.bottom + GAP;
      if (top + h > window.innerHeight - EDGE) top = r.top - GAP - h;
    }
    el.style.left = `${Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE))}px`;
    el.style.top = `${Math.max(EDGE, Math.min(top, window.innerHeight - h - EDGE))}px`;
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={label} role="tooltip" className="hover-label" data-wrap={tip.text.length > WRAP_AFTER || undefined}>
      {tip.text}
      {tip.keys && <span className="hover-label-keys">{tip.keys}</span>}
    </div>
  );
}
