"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { authorColorCss } from "@/lib/profile-rules";
import {
  AUTHORS,
  BIBLE,
  buildFrames,
  type Demo,
  type DemoChar,
  type Frame,
  NOTES,
  TOGETHER,
  type WriterId,
} from "@/lib/writing-demo";
import { Avatar, AvatarStack, type AvatarPerson } from "./Avatar";
import mentions from "./EntryMentions.module.css";
import prose from "./LiveDocument.module.css";
import notes from "./notes/notes.module.css";
import { Switch } from "./Switch";
import styles from "./WritingDemo.module.css";

const WRITERS: Record<WriterId, AvatarPerson> = {
  maya: { id: "maya", name: "maya", color: "#3e63dd" },
  theo: { id: "theo", name: "theo", color: "#12a594" },
  juno: { id: "juno", name: "juno", color: "#d6409f" },
};

const DEMOS = {
  together: buildFrames(TOGETHER),
  notes: buildFrames(NOTES),
  authors: buildFrames(AUTHORS),
  bible: buildFrames(BIBLE),
};

/**
 * The current frame of a demo, advancing every 70ms. With `whenVisible` it only advances while `ref` is on screen,
 * and picks up where it paused. Under reduced motion it holds the demo's still frame.
 */
function useDemoFrame(demo: Demo, whenVisible: boolean) {
  const ref = useRef<HTMLElement>(null);
  const [tick, setTick] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let onScreen = !whenVisible;
    let timer: number | undefined;
    const sync = () => {
      window.clearInterval(timer);
      setStill(reduce.matches);
      if (!reduce.matches && onScreen) timer = window.setInterval(() => setTick((t) => t + 1), 70);
    };
    const observer = whenVisible
      ? new IntersectionObserver(([entry]) => {
          onScreen = entry.isIntersecting;
          sync();
        })
      : null;
    if (ref.current) observer?.observe(ref.current);
    sync();
    reduce.addEventListener("change", sync);
    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
      reduce.removeEventListener("change", sync);
    };
  }, [whenVisible]);

  return { ref, frame: still ? demo.frames[demo.still] : demo.frames[tick % demo.frames.length] };
}

/** maya and theo typing on one page, drawn with the editor's own prose and caret styles. */
export function WritingDemo() {
  const { ref, frame } = useDemoFrame(DEMOS.together, false);

  return (
    <figure ref={ref} className={styles.demo} aria-label="An example of two Writers typing on the same page">
      <div className={styles.stage} inert aria-hidden>
        <DemoProse frame={frame} className={styles.hero} />
      </div>
      <figcaption className={styles.foot}>
        <AvatarStack people={[WRITERS.maya, WRITERS.theo]} size="sm" />
        <span>Example Story · 2 Writers, 14 Viewers</span>
      </figcaption>
    </figure>
  );
}

/** A Note pinned to a passage, answered, fixed and Resolved. */
export function NotesDemo() {
  const { ref, frame } = useDemoFrame(DEMOS.notes, true);
  const { flags, fields } = frame;

  return (
    <SmallDemo
      figureRef={ref}
      frame={frame}
      writers={["maya", "theo"]}
      label="An example of a Note pinned to a passage, answered and Resolved"
    >
      <DemoProse frame={frame} />
      {flags.noteOpen && (
        <div className={`${notes.card} ${styles.note}`} data-active data-resolved={flags.resolved || undefined}>
          <div className={notes.quote}>Eleven bells</div>
          <NoteMessage who="theo" body={fields.nt} />
          {flags.replyOpen && (
            <ul className={notes.replies}>
              <li>
                <NoteMessage who="maya" body={fields.nr} />
              </li>
            </ul>
          )}
          {flags.resolveShown && (
            <div className={notes.actions}>
              <span className={`button button-ghost button-tiny ${notes.resolve}`}>&#10003; Resolve</span>
            </div>
          )}
        </div>
      )}
    </SmallDemo>
  );
}

function NoteMessage({ who, body }: { who: WriterId; body?: string }) {
  return (
    <div className={notes.message}>
      <Avatar name={WRITERS[who].name} color={WRITERS[who].color} size="sm" />
      <div className={notes.messageMain}>
        <div className={notes.byline}>
          <span className={notes.name}>{who}</span>
          <span className={notes.when}>now</span>
        </div>
        <div className={`${notes.body} ${styles.noteBody}`}>{body}</div>
      </div>
    </div>
  );
}

/** Show authors tints each Writer's words, and juno types on in her Author Color. */
export function AuthorsDemo() {
  const { ref, frame } = useDemoFrame(DEMOS.authors, true);

  return (
    <SmallDemo
      figureRef={ref}
      frame={frame}
      writers={["maya", "theo", "juno"]}
      label="An example of Show authors tinting each Writer's words in their Author Color"
      footer={
        <span inert>
          <Switch checked={!!frame.flags.showAuthors} onChange={() => {}}>
            Show authors
          </Switch>
        </span>
      }
    >
      <DemoProse frame={frame} />
    </SmallDemo>
  );
}

/** An Alias becomes an Entry Mention and its Entry card opens under it. */
export function BibleDemo() {
  const { ref, frame } = useDemoFrame(DEMOS.bible, true);
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const open = !!frame.flags.entryCard;

  useLayoutEffect(() => {
    const mention = stage.current?.querySelector("[data-mention]");
    if (!mention || !card.current || !stage.current) return;
    const at = mention.getBoundingClientRect();
    const box = stage.current.getBoundingClientRect();
    card.current.style.top = `${at.bottom - box.top}px`;
    card.current.style.setProperty("--x", `${at.left - box.left}px`);
  }, [frame]);

  return (
    <SmallDemo
      figureRef={ref}
      stageRef={stage}
      frame={frame}
      writers={["maya", "theo"]}
      label="An example of a Story Bible name underlined as it's typed, with its Entry shown"
    >
      <DemoProse frame={frame} hoverMention={open} />
      <div ref={card} className={`${mentions.card} ${styles.entry}`} data-open={open || undefined}>
        <span className="smallcaps">Character</span>
        <span className={mentions.name}>Keeper Aldous</span>
        <span className={mentions.description}>Keeps the light on the Lantern Spit.</span>
        <span className={mentions.preview}>
          Took the post the winter the eleventh boat went down, and has rung the bells at every spring tide since.
          Will not speak of his brother.
        </span>
        <span className={mentions.open}>Open Entry &rarr;</span>
      </div>
    </SmallDemo>
  );
}

function SmallDemo({
  figureRef,
  stageRef,
  frame,
  writers,
  label,
  footer,
  children,
}: {
  figureRef: React.Ref<HTMLElement>;
  stageRef?: React.Ref<HTMLDivElement>;
  frame: Frame;
  writers: WriterId[];
  label: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <figure ref={figureRef} className={`${styles.demo} ${styles.small}`} aria-label={label}>
      <div ref={stageRef} className={styles.stage} data-fading={frame.fading} inert aria-hidden>
        {children}
      </div>
      <figcaption className={styles.foot}>
        <AvatarStack people={writers.map((w) => WRITERS[w])} size="sm" />
        {footer}
      </figcaption>
    </figure>
  );
}

/** A frame's paragraphs as runs of one author, highlight and mention, with the visible carets spliced in. */
function DemoProse({ frame, className, hoverMention }: { frame: Frame; className?: string; hoverMention?: boolean }) {
  return (
    <div
      className={`${prose.prose} ${prose.authorship} ${styles.prose} ${className ?? ""}`}
      data-show-authors={frame.flags.showAuthors || undefined}
    >
      {frame.paras.map((para, p) => (
        <p key={p}>
          {para.length === 0 && "​"}
          {runs(frame, para, p).map((run, i) =>
            "caret" in run ? (
              <Caret key={i} who={run.caret} />
            ) : (
              <span
                key={i}
                data-author={run.a}
                data-mention={run.m || undefined}
                data-hover={(run.m && hoverMention) || undefined}
                className={`${run.h ? notes.highlight : ""} ${run.m ? mentions.entryMention : ""}`}
                style={{ "--author-tint": authorColorCss(WRITERS[run.a].color) } as React.CSSProperties}
              >
                {run.text}
              </span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

type Run = { caret: WriterId } | (Omit<DemoChar, "c"> & { text: string });

function runs(frame: Frame, para: DemoChar[], p: number): Run[] {
  const out: Run[] = [];
  const carets = Object.entries(frame.carets) as [WriterId, { p: number; o: number; visible: boolean }][];
  for (let o = 0; o <= para.length; o++) {
    for (const [who, k] of carets) if (k.visible && k.p === p && k.o === o) out.push({ caret: who });
    if (o === para.length) break;
    const ch = para[o];
    const prev = out[out.length - 1];
    if (prev && !("caret" in prev) && prev.a === ch.a && prev.h === ch.h && prev.m === ch.m) prev.text += ch.c;
    else out.push({ a: ch.a, h: ch.h, m: ch.m, text: ch.c });
  }
  return out;
}

function Caret({ who }: { who: WriterId }) {
  return (
    <span
      className="collaboration-carets__caret"
      style={{ "--author": authorColorCss(WRITERS[who].color) } as React.CSSProperties}
    >
      <span className="collaboration-carets__label">{who}</span>
    </span>
  );
}
