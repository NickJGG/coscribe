"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { pinEntry, unpinEntry } from "@/lib/actions/pins";
import { useLocalSetting } from "@/lib/local-setting";
import { withoutPin, withPin } from "@/lib/pins";
import { PinIcon } from "./icons";

export const SHOW_PINS_KEY = "coscribe:show-pins";
const PHONE = "(max-width: 600px)";

type PinnedEntriesValue = {
  /** Pinned Entry ids, newest first. */
  ids: string[];
  canPin: boolean;
  isPinned: (entryId: string) => boolean;
  pin: (entryId: string) => Promise<void>;
  unpin: (entryId: string) => Promise<void>;
  /** The last Pin or Unpin that failed, until the next one. */
  error: { entryId: string; message: string } | null;
};

const PinnedEntriesContext = createContext<PinnedEntriesValue | null>(null);

/** The viewer's Pinned Entries in this Story, or null outside the desk. */
export function usePinnedEntries() {
  return useContext(PinnedEntriesContext);
}

/** Pin and Unpin change the list at once and put it back if the action fails. */
export function PinnedEntriesProvider({
  storyId,
  initialIds,
  canPin,
  children,
}: {
  storyId: string;
  initialIds: string[];
  canPin: boolean;
  children: React.ReactNode;
}) {
  const [ids, setIds] = useState(initialIds);
  const [error, setError] = useState<PinnedEntriesValue["error"]>(null);
  const [, setShowPins] = useLocalSetting(SHOW_PINS_KEY, true);

  const pin = useCallback(
    async (entryId: string) => {
      setError(null);
      setIds((current) => withPin(current, entryId));
      if (!matchMedia(PHONE).matches) setShowPins(true);
      const message = await pinEntry(storyId, entryId);
      if (!message) return;
      setIds((current) => withoutPin(current, entryId));
      setError({ entryId, message });
    },
    [storyId, setShowPins]
  );

  const unpin = useCallback(
    async (entryId: string) => {
      setError(null);
      const at = Math.max(ids.indexOf(entryId), 0);
      setIds((current) => withoutPin(current, entryId));
      const message = await unpinEntry(storyId, entryId);
      if (!message) return;
      setIds((current) => (current.includes(entryId) ? current : current.toSpliced(at, 0, entryId)));
      setError({ entryId, message });
    },
    [storyId, ids]
  );

  const value = useMemo<PinnedEntriesValue>(
    () => ({ ids, canPin, isPinned: (entryId) => ids.includes(entryId), pin, unpin, error }),
    [ids, canPin, pin, unpin, error]
  );

  return <PinnedEntriesContext value={value}>{children}</PinnedEntriesContext>;
}

/**
 * A Pin / Unpin toggle for one Entry, with the label beside the icon, or as a tooltip when `iconOnly`.
 * Renders nothing outside the provider or for someone who can't Pin.
 */
export function PinButton({
  entryId,
  entryName,
  className = "button button-ghost button-tiny with-icon",
  iconOnly = false,
}: {
  entryId: string;
  entryName: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const pins = usePinnedEntries();
  if (!pins?.canPin) return null;
  const pinned = pins.isPinned(entryId);
  const label = pinned ? "Unpin" : "Pin";
  return (
    <button
      type="button"
      className={className}
      aria-pressed={pinned}
      aria-label={iconOnly ? `${label} ${entryName}` : undefined}
      data-tip={iconOnly ? label : undefined}
      onClick={() => void (pinned ? pins.unpin(entryId) : pins.pin(entryId))}
    >
      <PinIcon />
      {!iconOnly && label}
    </button>
  );
}

/** The failed Pin or Unpin's message, shown where `entryId` (or, without one, any Entry) was toggled. */
export function PinError({ entryId, className }: { entryId?: string; className?: string }) {
  const error = usePinnedEntries()?.error;
  if (!error || (entryId && error.entryId !== entryId)) return null;
  return (
    <p role="alert" className={className}>
      {error.message}
    </p>
  );
}
