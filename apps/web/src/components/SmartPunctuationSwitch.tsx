"use client";

import { useOptimistic, useTransition } from "react";
import { setSmartPunctuation } from "@/lib/actions/stories";
import { Switch } from "./Switch";

export function SmartPunctuationSwitch({ storyId, on }: { storyId: string; on: boolean }) {
  const [checked, setChecked] = useOptimistic(on);
  const [, startTransition] = useTransition();

  return (
    <Switch
      checked={checked}
      label="Smart punctuation"
      onChange={(next) =>
        startTransition(async () => {
          setChecked(next);
          await setSmartPunctuation(storyId, next);
        })
      }
    />
  );
}
