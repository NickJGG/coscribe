import { afterEach, describe, expect, it } from "vitest";
import { hasOpenLayer, inLayerAbove, pushLayer, topLayer, type Layer } from "./layers";

const node = (name: string) => ({ name }) as unknown as Node;
const layerOf = (...nodes: Node[]): Layer => ({ contains: (n) => nodes.includes(n) });

const pops: (() => void)[] = [];
const push = (layer: Layer) => {
  pops.push(pushLayer(layer));
  return layer;
};

afterEach(() => {
  while (pops.length) pops.pop()!();
});

describe("layers", () => {
  it("starts empty", () => {
    expect(hasOpenLayer()).toBe(false);
    expect(topLayer()).toBeUndefined();
  });

  it("puts the latest on top, and popping uncovers the one beneath", () => {
    const popover = push(layerOf());
    const menu = layerOf();
    const popMenu = pushLayer(menu);
    expect(topLayer()).toBe(menu);
    popMenu();
    expect(topLayer()).toBe(popover);
    expect(hasOpenLayer()).toBe(true);
  });

  it("pops a layer from the middle without disturbing the others", () => {
    const below = push(layerOf());
    const middle = layerOf();
    const popMiddle = pushLayer(middle);
    const above = push(layerOf());
    popMiddle();
    expect(topLayer()).toBe(above);
    pops.pop()!();
    expect(topLayer()).toBe(below);
  });

  it("popping twice is harmless", () => {
    const below = push(layerOf());
    const pop = pushLayer(layerOf());
    pop();
    pop();
    expect(topLayer()).toBe(below);
  });

  it("finds a node only in layers above the given one", () => {
    const inPopover = node("popover");
    const inMenu = node("menu");
    const inDialog = node("dialog");
    const popover = push(layerOf(inPopover));
    const menu = push(layerOf(inMenu));
    push(layerOf(inDialog));
    expect(inLayerAbove(popover, inMenu)).toBe(true);
    expect(inLayerAbove(popover, inDialog)).toBe(true);
    expect(inLayerAbove(popover, inPopover)).toBe(false);
    expect(inLayerAbove(menu, inPopover)).toBe(false);
    expect(inLayerAbove(menu, inDialog)).toBe(true);
  });

  it("a closed layer has nothing above it", () => {
    const inMenu = node("menu");
    push(layerOf(inMenu));
    expect(inLayerAbove(layerOf(), inMenu)).toBe(false);
  });
});
