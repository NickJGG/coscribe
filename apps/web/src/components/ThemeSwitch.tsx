"use client";

import { useOptimistic, useTransition } from "react";
import { setTheme, type Theme } from "@/lib/actions/profile";

const OPTIONS: [Theme, string][] = [
  ["light", "Light"],
  ["dark", "Dark"],
  ["system", "Auto"],
];

/** Light, Dark or Auto. Applies at once, then saves to the profile so every device follows. */
export function ThemeSwitch({ theme }: { theme: Theme }) {
  const [shown, setShown] = useOptimistic(theme);
  const [, startTransition] = useTransition();

  function choose(next: Theme) {
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    startTransition(async () => {
      setShown(next);
      await setTheme(next);
    });
  }

  return (
    <span className="segmented" role="group" aria-label="Theme">
      {OPTIONS.map(([value, label]) => (
        <button key={value} type="button" aria-pressed={shown === value} onClick={() => choose(value)}>
          {label}
        </button>
      ))}
    </span>
  );
}
