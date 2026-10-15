"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import { hasOpenLayer, inLayerAbove, pushLayer, topLayer, type Layer } from "@/lib/layers";

/**
 * Closes a popover while `open`: Escape (only the topmost layer's), a press outside `root`, or focus moving
 * outside it. Only Escape moves focus, to `returnTo()`, and only when focus was inside `root` or nowhere,
 * so a popover opened by mouse that left focus in the editor leaves it there. Anything in a layer opened
 * above this one counts as inside, as does what `ignoreOutside` claims.
 *
 * Returns `dismiss(refocus)` for Cancel, × and completed actions.
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  {
    root,
    returnTo,
    ignoreOutside,
  }: {
    root: RefObject<HTMLElement | null>;
    returnTo?: () => HTMLElement | null;
    ignoreOutside?: (target: Node) => boolean;
  }
): (refocus: boolean) => void {
  const dismiss = (refocus: boolean) => {
    close();
    if (refocus) returnTo?.()?.focus();
  };

  const isOutside = (layer: Layer, node: Node) =>
    !root.current?.contains(node) && !inLayerAbove(layer, node) && !ignoreOutside?.(node);

  const onEscape = useEffectEvent(() => {
    const focused = document.activeElement;
    dismiss(!focused || focused === document.body || !!root.current?.contains(focused));
  });

  const onPointerDown = useEffectEvent((layer: Layer, e: PointerEvent) => {
    if (isOutside(layer, e.target as Node)) close();
  });

  const onFocusOut = useEffectEvent((layer: Layer, e: FocusEvent) => {
    const next = e.relatedTarget;
    if (next instanceof Node && root.current?.contains(e.target as Node) && isOutside(layer, next)) close();
  });

  useEffect(() => {
    if (!open) return;
    const layer: Layer = {
      contains: (node) => !!root.current?.contains(node),
      escape: () => onEscape(),
    };
    const pointerDown = (e: PointerEvent) => onPointerDown(layer, e);
    const focusOut = (e: FocusEvent) => onFocusOut(layer, e);
    const pop = pushLayer(layer);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", pointerDown);
    document.addEventListener("focusout", focusOut);
    return () => {
      pop();
      if (!hasOpenLayer()) document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", pointerDown);
      document.removeEventListener("focusout", focusOut);
    };
  }, [open, root]);

  return dismiss;
}

// Bubbling, so an Escape something inside already took (a mention picker, an edit's Cancel) isn't the
// layer's. Stopping it here keeps it from window listeners (side panels); listeners on document check
// hasOpenLayer() or defaultPrevented instead. Added once however many layers are open.
function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
  const top = topLayer();
  if (!top?.escape) return;
  e.preventDefault();
  e.stopPropagation();
  top.escape();
}
