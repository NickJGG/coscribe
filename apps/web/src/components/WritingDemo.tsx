"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authorColorCss } from "@/lib/profile-rules";
import {
  AUTHORS,
  BIBLE,
  buildFrames,
  type Demo,
  type DemoChar,
  type Frame,
  NOTES,
  peakFrames,
  TOGETHER,
  type WriterId,
} from "@/lib/writing-demo";
import { Authorship } from "./Authorship";
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

const AUTHORS_LIST = Object.values(WRITERS);

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
  return (
    <SmallDemo
      demo={DEMOS.notes}
      writers={["maya", "theo"]}
      label="An example of a Note pinned to a passage, answered and Resolved"
      render={(frame) => <NoteFrame frame={frame} />}
    />
  );
}

function NoteFrame({ frame }: { frame: Frame }) {
  const { flags, fields } = frame;
  return (
    <>
      <DemoProse frame={frame} activeNote={flags.noteOpen && !flags.resolved} />
      {flags.noteOpen && (
        <div className={`${notes.card} ${styles.note}`} data-active data-resolved={flags.resolved || undefined}>
          <blockquote className={notes.quote}>Eleven bells</blockquote>
          <NoteMessage who="theo" body={fields.nt} />
          {flags.replyOpen && (
            <ol className={notes.replies}>
              <li>
                <NoteMessage who="maya" body={fields.nr} />
              </li>
            </ol>
          )}
          {flags.resolveShown && (
            <div className={notes.actions}>
              <button type="button" className={`button button-ghost button-tiny ${notes.resolve}`}>
                &#10003; Resolve
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function NoteMessage({ who, body }: { who: WriterId; body?: string }) {
  return (
    <div className={notes.message}>
      <Avatar name={WRITERS[who].name} color={WRITERS[who].color} size="sm" />
      <div className={notes.messageMain}>
        <div className={notes.byline}>
          <b className={notes.name}>{who}</b>
          <span className={notes.when}>just now</span>
        </div>
        <p className={`${notes.body} ${styles.noteBody}`}>{body}</p>
      </div>
    </div>
  );
}

/** Show authors tints each Writer's words, and juno types on in her Author Color. */
export function AuthorsDemo() {
  return (
    <SmallDemo
      demo={DEMOS.authors}
      writers={["maya", "theo", "juno"]}
      label="An example of Show authors tinting each Writer's words in their Author Color"
      footer={(frame) => (
        <span inert>
          <Switch checked={!!frame.flags.showAuthors} onChange={() => {}}>
            Show authors
          </Switch>
        </span>
      )}
      render={(frame) => <DemoProse frame={frame} />}
    />
  );
}

/** An Alias becomes an Entry Mention and its Entry card opens under it. */
export function BibleDemo() {
  return (
    <SmallDemo
      demo={DEMOS.bible}
      writers={["maya", "theo"]}
      label="An example of a Story Bible name underlined as it's typed, with its Entry shown"
      place={placeEntryCard}
      render={(frame) => {
        const open = !!frame.flags.entryCard;
        return (
          <>
            <DemoProse frame={frame} hoverMention={open} />
            <div className={`${mentions.card} ${styles.entry}`} data-entry-card data-open={open || undefined}>
              <span className="smallcaps">Character</span>
              <strong className={mentions.name}>Keeper Aldous</strong>
              <p className={mentions.description}>Keeps the light on the Lantern Spit.</p>
              <p className={mentions.preview}>
                Took the post the winter the eleventh boat went down, and has rung the bells at every spring tide
                since. Will not speak of his brother.
              </p>
              <Link href="/stories" className={mentions.open}>
                Open Entry &rarr;
              </Link>
            </div>
          </>
        );
      }}
    />
  );
}

function placeEntryCard(layer: HTMLElement) {
  const mention = layer.querySelector("[data-mention]");
  const card = layer.querySelector<HTMLElement>("[data-entry-card]");
  if (!mention || !card) return;
  const at = mention.getBoundingClientRect();
  const box = layer.getBoundingClientRect();
  card.style.top = `${at.bottom - box.top}px`;
  card.style.setProperty("--x", `${at.left - box.left}px`);
}

/**
 * A small demo's card. Its stage is exactly as tall as the demo's tallest moment: each peak frame is rendered
 * invisibly and measured, again whenever the width or fonts change, so nothing is cut off and nothing jumps.
 */
function SmallDemo({
  demo,
  writers,
  label,
  render,
  place,
  footer,
}: {
  demo: Demo;
  writers: WriterId[];
  label: string;
  render: (frame: Frame) => React.ReactNode;
  place?: (layer: HTMLElement) => void;
  footer?: (frame: Frame) => React.ReactNode;
}) {
  const { ref, frame } = useDemoFrame(demo, true);
  const peaks = useMemo(() => peakFrames(demo), [demo]);
  const stage = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (live.current) place?.(live.current);
  }, [frame, place]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const sizers = [...el.querySelectorAll<HTMLElement>("[data-sizer]")];
    const measure = () => {
      for (const s of sizers) place?.(s);
      el.style.setProperty("--stage-height", `${Math.max(...sizers.map((s) => s.scrollHeight))}px`);
      if (live.current) place?.(live.current);
    };
    const observer = new ResizeObserver(measure);
    for (const s of sizers) observer.observe(s);
    return () => observer.disconnect();
  }, [place]);

  return (
    <figure ref={ref} className={`${styles.demo} ${styles.small}`} aria-label={label}>
      <div ref={stage} className={styles.stage} data-fading={frame.fading} inert aria-hidden>
        <div ref={live} className={styles.layer}>
          {render(frame)}
        </div>
        {peaks.map((peak, i) => (
          <div key={i} className={`${styles.layer} ${styles.sizer}`} data-sizer>
            {render(peak)}
          </div>
        ))}
      </div>
      <figcaption className={styles.foot}>
        <AvatarStack people={writers.map((w) => WRITERS[w])} size="sm" />
        {footer?.(frame)}
      </figcaption>
    </figure>
  );
}

/** A frame's paragraphs as runs of one author, highlight and mention, with the visible carets spliced in. */
function DemoProse({
  frame,
  className,
  hoverMention,
  activeNote,
}: {
  frame: Frame;
  className?: string;
  hoverMention?: boolean;
  activeNote?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);

  // A caret at the end of a line would push its label past the edge, where it's clipped; flip it to the left.
  useLayoutEffect(() => {
    if (!box.current) return;
    const right = box.current.getBoundingClientRect().right;
    for (const label of box.current.querySelectorAll<HTMLElement>(".collaboration-carets__label")) {
      delete label.dataset.flip;
      if (label.getBoundingClientRect().right > right) label.dataset.flip = "";
    }
  }, [frame]);

  return (
    <Authorship authors={AUTHORS_LIST} show={!!frame.flags.showAuthors} bars={false}>
      <div ref={box} className={`${prose.prose} ${styles.prose} ${className ?? ""}`}>
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
                  className={`${run.h ? notes.highlight : ""} ${run.h && activeNote ? notes.active : ""} ${run.m ? mentions.entryMention : ""}`}
                >
                  {run.text}
                </span>
              ),
            )}
          </p>
        ))}
      </div>
    </Authorship>
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
