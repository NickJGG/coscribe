/**
 * The open popovers, menus and dialogs, in the order they opened. Only the top one answers Escape, and a
 * layer treats anything inside a layer above it as inside itself, so a menu in a popover, or a dialog
 * opened from that menu, doesn't close what's beneath.
 */
export type Layer = {
  contains: (node: Node) => boolean;
  /** Absent where the layer handles Escape itself, as a native `<dialog>` does. */
  escape?: () => void;
};

const stack: Layer[] = [];

/** Returns the function that removes it again. */
export function pushLayer(layer: Layer): () => void {
  stack.push(layer);
  return () => {
    const at = stack.indexOf(layer);
    if (at >= 0) stack.splice(at, 1);
  };
}

export function topLayer(): Layer | undefined {
  return stack.at(-1);
}

export function hasOpenLayer(): boolean {
  return stack.length > 0;
}

export function inLayerAbove(layer: Layer, node: Node): boolean {
  const at = stack.indexOf(layer);
  return at >= 0 && stack.slice(at + 1).some((above) => above.contains(node));
}
