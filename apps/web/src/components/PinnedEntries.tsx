"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { pinEntry, unpinEntry } from "@/lib/actions/pins";
import { useLocalSetting } from "@/lib/local-setting";
import { visiblePins, withoutPin, withPin } from "@/lib/pins";
import { PinIcon } from "./icons";
import { Switch } from "./Switch";
import styles from "./PinnedEntries.module.css";

const SHOW_PINS_KEY = "coscribe:show-pins";
const PHONE = "(max-width: 600px)";

/** Whether the window is phone-sized, where the Pinned Entries are a sheet. False on the server. */
export function usePhone() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(PHONE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => matchMedia(PHONE).matches,
    () => false
  );
}

type PinnedEntriesValue = {
  /** Pinned Entry ids, newest first. */
  ids: string[];
  canPin: boolean;
  isPinned: (entryId: string) => boolean;
  pin: (entryId: string) => Promise<void>;
  unpin: (entryId: string) => Promise<void>;
  /** The last Pin or Unpin that failed, until the next one. */
  error: { entryId: string; message: string } | null;
  /** Show pins, remembered by this browser. Phones ignore it. */
  show: boolean;
  setShow: (show: boolean) => void;
  /** The phone sheet. It starts closed. */
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
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
  const [show, setShow] = useLocalSetting(SHOW_PINS_KEY, true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const pin = useCallback(
    async (entryId: string) => {
      setError(null);
      setIds((current) => withPin(current, entryId));
      if (!matchMedia(PHONE).matches) setShow(true);
      const message = await pinEntry(storyId, entryId);
      if (!message) return;
      setIds((current) => withoutPin(current, entryId));
      setError({ entryId, message });
    },
    [storyId, setShow]
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
    () => ({
      ids,
      canPin,
      isPinned: (entryId) => ids.includes(entryId),
      pin,
      unpin,
      error,
      show,
      setShow,
      sheetOpen,
      setSheetOpen,
    }),
    [ids, canPin, pin, unpin, error, show, setShow, sheetOpen]
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
      <PinIcon filled={pinned} />
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

/**
 * The Chapter toolbar's Show pins switch, or on phones a button opening the sheet with the count. Shown only
 * to someone who can Pin, with at least one Pinned Entry among `entries`.
 */
export function PinsToggle({ entries }: { entries: { id: string }[] }) {
  const pins = usePinnedEntries();
  const count = pins ? visiblePins(pins.ids, entries).length : 0;
  if (!pins?.canPin || count === 0) return null;

  return (
    <>
      <span className={styles.notPhone}>
        <Switch checked={pins.show} onChange={pins.setShow}>
          Show pins
        </Switch>
      </span>
      <span className={styles.phone}>
        <button
          type="button"
          className="button button-ghost button-tiny with-icon"
          aria-expanded={pins.sheetOpen}
          onClick={() => pins.setSheetOpen(!pins.sheetOpen)}
        >
          <PinIcon />
          <span className="with-icon-label">Pinned</span>
          <span className={styles.count}>{count}</span>
        </button>
      </span>
    </>
  );
}
