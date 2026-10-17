const MODIFIERS = ["Ctrl", "Alt", "Shift", "Mod"] as const;
type Modifier = (typeof MODIFIERS)[number];

const MAC_SYMBOLS: Record<Modifier, string> = { Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Mod: "⌘" };

const CHORD = /\b((?:(?:Mod|Ctrl|Alt|Shift)\+)+)(\S+)/g;

// Mirrors prosemirror-keymap, so labels match the bindings TipTap's Mod- resolves to.
const isMac = () => typeof navigator !== "undefined" && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

/** "Mod+Shift+S · type > and a space" → "⇧⌘S · type > and a space" on Mac, "Ctrl+Shift+S · …" elsewhere. */
export function formatKeys(text: string, mac = isMac()): string {
  return text.replace(CHORD, (_, prefix: string, key: string) => {
    const held = new Set(prefix.split("+").filter(Boolean) as Modifier[]);
    if (!mac && held.delete("Mod")) held.add("Ctrl");
    const ordered = MODIFIERS.filter((m) => held.has(m));
    return mac ? ordered.map((m) => MAC_SYMBOLS[m]).join("") + key : [...ordered, key].join("+");
  });
}
