"use client";

import { useMemo } from "react";
import Link from "next/link";
import { latestActivity } from "@/lib/notes";
import { Avatar } from "@/components/Avatar";
import { NoteCard } from "@/components/notes/NoteMargin";
import { NoteThreadContext } from "@/components/notes/NoteThreads";
import { useStoryNotes } from "@/components/notes/StoryNotesProvider";
import { useStoryPanel } from "@/components/StoryPanel";
import { useHereNow, type HereNow } from "@/components/StoryPresence";
import { useDeskFrame } from "../DeskFrame";
import styles from "./overview.module.css";

/** A card for each Writer here now, linking to what they have open. Nothing when nobody's here. */
export function WritingNow({
  storyId,
  chapters,
  entries,
  member,
}: {
  storyId: string;
  chapters: { id: string; title: string }[];
  entries: { id: string; name: string }[];
  member: boolean;
}) {
  const here = useHereNow();
  if (!here.length) return null;

  return (
    <section className={styles.section} aria-labelledby="overview-writing-now">
      <h2 id="overview-writing-now" className={`smallcaps ${styles.liveHeading}`}>
        Writing now
      </h2>
      {here.map((h) => {
        const where = whereIs(h, chapters, entries);
        return (
          <Link
            key={h.userId}
            href={`/stories/${storyId}/${h.kind === "chapter" ? "chapters" : "bible"}/${h.documentId}`}
            className={styles.card}
          >
            <Avatar name={h.person.name} color={h.person.color} />
            <span className={styles.cardText}>
              <span className={styles.cardName}>{h.person.name}</span>
              {where && <span className={styles.cardWhere}>{where}</span>}
            </span>
            <span className={styles.cardGo}>{member ? "Join" : "Watch"} &rarr;</span>
          </Link>
        );
      })}
    </section>
  );
}

function whereIs(h: HereNow, chapters: { id: string; title: string }[], entries: { id: string; name: string }[]) {
  if (h.kind === "chapter") {
    const i = chapters.findIndex((c) => c.id === h.documentId);
    return i < 0 ? null : `in Chapter ${i + 1} · ${chapters[i].title}`;
  }
  const entry = entries.find((e) => e.id === h.documentId);
  return entry ? `in the Story Bible · ${entry.name}` : null;
}

/** Marks a Writer who's in this Story right now. */
export function HereDot({ userId }: { userId: string }) {
  const here = useHereNow().some((h) => h.userId === userId);
  if (!here) return null;
  return (
    <span className={styles.hereDot} data-tip="Here now">
      <span className="sr-only">Here now</span>
    </span>
  );
}

export function BrowseButton() {
  const { open } = useDeskFrame();
  return (
    <div className={styles.browse}>
      <button type="button" className="button" onClick={() => open("chapters")}>
        Browse Chapters and the Story Bible
      </button>
    </div>
  );
}

const OPEN_NOTES_SHOWN = 5;

/**
 * The open Story Notes with the latest activity, each opening the Notes panel on itself, and "Show all".
 * Nothing for Viewers or when none are open.
 */
export function OpenStoryNotes() {
  const story = useStoryNotes();
  const show = useStoryPanel()?.show;
  const notes = story?.notes;
  const replies = story?.replies;
  const open = useMemo(() => (notes && replies ? latestActivity(notes, replies) : []), [notes, replies]);
  if (!story || !show || !open.length) return null;

  const openPanel = (id: string | null) => {
    story.setExpanded(id);
    show("notes");
  };

  return (
    <section className={styles.section} aria-labelledby="overview-notes">
      <div className={styles.notesHead}>
        <h2 id="overview-notes" className="smallcaps">
          Open Notes
        </h2>
        <button type="button" className="button button-ghost button-tiny" onClick={() => openPanel(null)}>
          Show all
        </button>
      </div>
      <NoteThreadContext value={story.thread}>
        <ol className={styles.notes}>
          {open.slice(0, OPEN_NOTES_SHOWN).map((note) => (
            <li key={note.id}>
              <NoteCard
                note={note}
                quote={null}
                replies={story.replies.filter((r) => r.note_id === note.id)}
                active={false}
                onActivate={() => openPanel(note.id)}
                onDeactivate={() => {}}
              />
            </li>
          ))}
        </ol>
      </NoteThreadContext>
    </section>
  );
}
