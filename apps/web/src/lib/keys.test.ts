import { describe, expect, it } from "vitest";
import { formatKeys } from "./keys";

describe("formatKeys", () => {
  const cases: [string, string, string][] = [
    ["Mod+B", "⌘B", "Ctrl+B"],
    ["Mod+Shift+S", "⇧⌘S", "Ctrl+Shift+S"],
    ["Shift+Mod+G", "⇧⌘G", "Ctrl+Shift+G"],
    ["Mod+Alt+M", "⌥⌘M", "Ctrl+Alt+M"],
    ["Mod+\\", "⌘\\", "Ctrl+\\"],
    ["Shift+Enter", "⇧Enter", "Shift+Enter"],
    ["Ctrl+Shift+Tab", "⌃⇧Tab", "Ctrl+Shift+Tab"],
    ["Escape", "Escape", "Escape"],
    ["/", "/", "/"],
    ["Mod+Shift+B · type > and a space", "⇧⌘B · type > and a space", "Ctrl+Shift+B · type > and a space"],
    ["Tab on an Action line", "Tab on an Action line", "Tab on an Action line"],
    ["Type *** on an empty line", "Type *** on an empty line", "Type *** on an empty line"],
  ];

  it.each(cases)("%s on Mac", (keys, mac) => expect(formatKeys(keys, true)).toBe(mac));
  it.each(cases)("%s elsewhere", (keys, _, other) => expect(formatKeys(keys, false)).toBe(other));
});
