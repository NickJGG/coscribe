"use client";

import { useOptimistic, useTransition } from "react";
import { setShowWritingDays } from "@/lib/actions/profile";
import { Switch } from "./Switch";

export function ShowWritingDaysSwitch({ show }: { show: boolean }) {
  const [shown, setShown] = useOptimistic(show);
  const [, startTransition] = useTransition();

  return (
    <Switch
      checked={shown}
      label="Show my writing days on my profile"
      onChange={(next) =>
        startTransition(async () => {
          setShown(next);
          await setShowWritingDays(next);
        })
      }
    />
  );
}
