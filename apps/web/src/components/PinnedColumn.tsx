"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ENTRY_TYPE_LABEL, type EntryMentionEntry } from "@/lib/entries";
import { visiblePins } from "@/lib/pins";
import { useNarrowDesk } from "./DeskScroll";
import { CloseIcon } from "./icons";
import { LiveDocument, type StoryAuthor, type Writer } from "./LiveDocument";
import { PinButton, PinError, usePhone, usePinnedEntries } from "./PinnedEntries";
import { createSlot } from "./Slot";
import { useStoryPanel } from "./StoryPanel";
import styles from "./PinnedColumn.module.css";

/** How much of a body a card shows until Show all, in ems of its text. */
const CLAMP_EM = 6.4;

const Slot = createSlot();

/** Wraps the desk so a Chapter's Pinned Entries can move into the PinnedSlot. */
export const PinnedSlotProvider = Slot.Provider;

/** Where the Pinned Entries go when the page is too narrow for them beside the text: over the page's left. */
export function PinnedSlot() {
  return <Slot.Target className={styles.slot} />;
}

/**
 * The viewer's Pinned Entries beside a Chapter, newest first, each with its live body. Wide, a sticky column
 * left of the text (chapter.module.css places `data-pinned-entries`). Narrower, a panel in the PinnedSlot,
 * giving way to the right-hand panel. On phones, a sheet the toolbar's PinnedButton opens. Show pins hides
 * all but the sheet.
 */
export function PinnedColumn({
  storyId,
  entries,
  writer,
  authors,
}: {
  storyId: string;
  entries: EntryMentionEntry[];
  writer: Writer | null;
  authors: StoryAuthor[];
}) {
  const pins = usePinnedEntries();
  const narrow = useNarrowDesk();
  const phone = usePhone();
  const panelOpen = !!useStoryPanel()?.open;
  const sheetOpen = !!pins?.sheetOpen;
  const setSheetOpen = pins?.setSheetOpen;
  const headingId = useId();

  useEffect(() => () => setSheetOpen?.(false), [setSheetOpen]);

  useEffect(() => {
    if (!phone || !sheetOpen || !setSheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phone, sheetOpen, setSheetOpen]);

  if (!pins?.canPin) return null;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const pinned = visiblePins(pins.ids, entries).map((id) => byId.get(id)!);
  if (!pinned.length) return null;

  const cards = pinned.map((entry) => (
    <PinnedCard key={entry.id} storyId={storyId} entry={entry} writer={writer} authors={authors} />
  ));

  if (phone) {
    return (
      <Slot.Fill>
        <aside className={styles.sheet} hidden={!sheetOpen} aria-labelledby={headingId}>
          <header className={styles.sheetHead}>
            <h2 id={headingId} className={styles.sheetHeading}>
              Pinned
            </h2>
            <button type="button" className={styles.close} onClick={() => pins.setSheetOpen(false)} aria-label="Close Pinned">
              <CloseIcon className={styles.closeIcon} />
            </button>
          </header>
          {sheetOpen && <div className={styles.sheetBody}>{cards}</div>}
        </aside>
      </Slot.Fill>
    );
  }
  if (!pins.show || narrow === null) return null;
  if (narrow) {
    if (panelOpen) return null;
    return (
      <Slot.Fill>
        <aside className={styles.panel} aria-label="Pinned Entries">
          {cards}
        </aside>
      </Slot.Fill>
    );
  }
  return (
    <aside aria-label="Pinned Entries" data-pinned-entries>
      <div className={styles.column}>{cards}</div>
    </aside>
  );
}

/**
 * One Pinned Entry: its details, read-only, and its body, live and cut short until Show all. Clicking or
 * focusing into a cut-off body shows it all.
 */
function PinnedCard({
  storyId,
  entry,
  writer,
  authors,
}: {
  storyId: string;
  entry: EntryMentionEntry;
  writer: Writer | null;
  authors: StoryAuthor[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [tall, setTall] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const clamped = tall && !expanded;

  useEffect(() => {
    const box = body.current;
    const content = box?.firstElementChild;
    if (!box || !content) return;
    const measure = () => {
      const em = parseFloat(getComputedStyle(box).fontSize);
      setTall(content.getBoundingClientRect().height > CLAMP_EM * em);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <article className={styles.card} aria-label={entry.name}>
      <header className={styles.head}>
        <span className="smallcaps">{ENTRY_TYPE_LABEL[entry.type]}</span>
        <PinButton entryId={entry.id} entryName={entry.name} className={styles.unpin} iconOnly />
      </header>
      <h3 className={styles.name}>{entry.name}</h3>
      {entry.description && <p className={styles.description}>{entry.description}</p>}
      {entry.aliases.length > 0 && (
        <ul className={styles.aliases} aria-label="Aliases">
          {entry.aliases.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <div
        ref={body}
        className={styles.body}
        data-clamped={clamped || undefined}
        style={clamped ? { maxHeight: `${CLAMP_EM}em` } : undefined}
        onFocus={() => setExpanded(true)}
        onClick={() => setExpanded(true)}
      >
        <LiveDocument kind="entry" id={entry.id} writer={writer} authors={authors} embedded />
      </div>
      <div className={styles.actions}>
        {tall && (
          <button type="button" className={styles.toggle} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : "Show all"}
          </button>
        )}
        <Link href={`/stories/${storyId}/bible/${entry.id}`} className={styles.open}>
          Open Entry &rarr;
        </Link>
      </div>
      <PinError entryId={entry.id} className={styles.error} />
    </article>
  );
}
