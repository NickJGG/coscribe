"use client";

import { useOptimistic, useTransition } from "react";
import { setShowOnline } from "@/lib/actions/profile";
import { Switch } from "./Switch";

export function ShowOnlineSwitch({ show }: { show: boolean }) {
  const [shown, setShown] = useOptimistic(show);
  const [, startTransition] = useTransition();

  return (
    <Switch
      checked={shown}
      label="Show me as online to Friends"
      onChange={(next) =>
        startTransition(async () => {
          setShown(next);
          await setShowOnline(next);
        })
      }
    />
  );
}
