"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { speakerKey, type NarrationSpeaker, type NarrationUnit } from "@coscribe/editor";
import { NO_VOICE, type EntryMentionEntry, type EntryVoice } from "@/lib/entries";
import { useLocalSetting } from "@/lib/local-setting";
import { cancel, speak } from "@/lib/narration/speaker";
import { castVoices, narratorVoice, useVoices, type CastVoice, type VoiceSupport } from "@/lib/narration/voices";

export const RATES = [0.75, 1, 1.25, 1.5, 2];
const DEFAULT_RATE = 1;
const RATE_KEY = "coscribe:narration-rate";
const VOICE_KEY = "coscribe:narration-voice";
const CHARACTER_VOICES_KEY = "coscribe:narration-character-voices";
/** Per Story, a JSON object of speaker key to the voice name a listener chose for that speaker. */
const castKey = (storyId: string) => `coscribe:narration-cast:${storyId}`;
/** How long a finished Chapter waits for the next one's source to attach before Narration gives up. */
const HANDOFF_MS = 15000;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/** A unit to read, and the source's own marker for where it is (an index, or a position that survives edits). */
export type NarrationCursor = { unit: NarrationUnit; anchor: unknown };

/** What Narration reads: a Chapter in the Reader View or the Desk. */
export type NarrationSource = {
  storyId: string;
  /** "Chapter n · Title", for the player. */
  title: string;
  /** The Story's Character Entries, whose dialogue is read in their Voices. */
  characters: readonly EntryMentionEntry[];
  /** Who speaks in the Chapter, in the order they first do. */
  speakers(): NarrationSpeaker[];
  /** The unit after `cursor`, or the first for null; null at the end. */
  next(cursor: NarrationCursor | null): NarrationCursor | null;
  /** The first unit of top-level block `block`, or the first after it. */
  at(block: number): NarrationCursor | null;
  /** `cursor` found again in text that may have changed since, as on resuming; null if nothing's left from there. */
  refresh?(cursor: NarrationCursor): NarrationCursor | null;
  /** The top-level blocks with text to read, in order. */
  blocks(): number[];
  highlight(unit: NarrationUnit | null): void;
  /** Where `unit` is on screen, for following it; null for one with no place, like the intro. */
  rect(unit: NarrationUnit): DOMRect | null;
  /** The element that scrolls, or null for the window. */
  scroller(): HTMLElement | null;
  /** The text, which takes clicks to jump while Listening and gets `data-narrating`. */
  container(): HTMLElement | null;
  /** The top-level block a click landed in. */
  blockAt(target: Element): number | null;
  /** Called after the last unit. Returning true keeps Narration going into the source the next page attaches. */
  onEnd(): boolean;
};

type Status = "idle" | "playing" | "paused";

/** A speaker in the Chapter being read, and the voice their part is read in. */
export type CastSpeaker = {
  key: string;
  name: string;
  /** The Voice cast on their Character Entry; null for a Script cue that names no Entry. */
  cast: EntryVoice | null;
  reading: CastVoice<SpeechSynthesisVoice>;
  /** Whether the listener picked `reading.voice` themselves. */
  overridden: boolean;
};

export function speakersOf(units: readonly NarrationUnit[]): NarrationSpeaker[] {
  const found = new Map<string, NarrationSpeaker>();
  for (const { speaker } of units) {
    if (speaker && !found.has(speakerKey(speaker))) found.set(speakerKey(speaker), speaker);
  }
  return [...found.values()];
}

const titleCase = (text: string) => text.toLowerCase().replace(/(^|\s)(\S)/gu, (_, space, c) => space + c.toUpperCase());

function speakerName(source: NarrationSource, speaker: NarrationSpeaker) {
  if ("cue" in speaker) return titleCase(speaker.cue);
  return source.characters.find((c) => c.id === speaker.entryId)?.name ?? null;
}

function readOverrides(json: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(json || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

type CastSettings = {
  voices: readonly SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  overrides: Readonly<Record<string, string>>;
};

function castFor(source: NarrationSource, speakers: readonly NarrationSpeaker[], { voices, voice, overrides }: CastSettings) {
  const cast = Object.fromEntries(source.characters.map((c) => [speakerKey({ entryId: c.id }), c.voice]));
  return castVoices({ speakers: speakers.map(speakerKey), voices, narrator: voice, cast, overrides });
}

type Narration = {
  support: VoiceSupport;
  status: Status;
  /** The source being read, or null (also between Chapters). */
  active: NarrationSource | null;
  title: string;
  paragraph: number;
  paragraphs: number;
  following: boolean;
  /** Which way the current sentence is from the view, once you've scrolled away. */
  behind: "up" | "down";
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  setVoice: (name: string) => void;
  /** Whether Characters' dialogue is read in their own voices, or everything by the narrator. */
  characterVoices: boolean;
  setCharacterVoices: (on: boolean) => void;
  /** The name of whoever says the part being read; null for the narrator. */
  speaker: string | null;
  /** The Chapter's speakers, in the order they first speak. */
  cast: CastSpeaker[];
  /** Picks the voice a speaker is read in for this Story, or with null goes back to the one cast for them. */
  setOverride: (key: string, voiceName: string | null) => void;
  rate: number;
  setRate: (rate: number) => void;
  start: (source: NarrationSource) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skip: (direction: -1 | 1) => void;
  jumpTo: (block: number) => void;
  backToReading: () => void;
  /** Registers a source while it's on the page; a Chapter that just ended carries on into it. Returns the cleanup. */
  attach: (source: NarrationSource) => () => void;
};

const NarrationContext = createContext<Narration | null>(null);

export function useNarration() {
  const narration = useContext(NarrationContext);
  if (!narration) throw new Error("useNarration outside NarrationProvider");
  return narration;
}

function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function viewOf(scroller: HTMLElement | null) {
  if (!scroller) return { top: 0, bottom: innerHeight };
  const { top, bottom } = scroller.getBoundingClientRect();
  return { top, bottom };
}

/** Brings `rect` into the upper middle of the view, unless it's comfortably in view already. */
function scrollToRect(scroller: HTMLElement | null, rect: DOMRect, force: boolean) {
  const view = viewOf(scroller);
  const height = view.bottom - view.top;
  const top = rect.top - view.top;
  if (!force && top >= height * 0.15 && rect.bottom - view.top <= height * 0.7) return;
  (scroller ?? window).scrollBy({ top: top - height * 0.3, behavior: reducedMotion() ? "instant" : "smooth" });
}

/**
 * Narration: reads a source aloud one unit at a time, highlighting each and keeping it in view until you scroll
 * away. With Character voices on, a Character's part is read in their cast voice and a Script cue is a silent pause.
 * Holds a Screen Wake Lock while playing, pauses when a phone's screen goes off, and remembers speed and voice per
 * browser, and voice picks for Characters per Story too. Mount it where it outlives the pages it reads, so one
 * Chapter can hand off to the next.
 */
export function NarrationProvider({ children }: { children: React.ReactNode }) {
  const { voices, support } = useVoices();
  const [rateIndex, setRateIndex] = useLocalSetting(RATE_KEY, RATES.indexOf(DEFAULT_RATE));
  const [voiceName, setVoiceName] = useLocalSetting(VOICE_KEY, "");
  const rate = RATES[rateIndex] ?? DEFAULT_RATE;
  const voice = narratorVoice(voices, voiceName);
  const [characterVoices, setCharacterVoices] = useLocalSetting(CHARACTER_VOICES_KEY, true);

  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState<NarrationSource | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState({ paragraph: 0, paragraphs: 0 });
  const [following, setFollowing] = useState(true);
  const [behind, setBehind] = useState<"up" | "down">("down");
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<NarrationSpeaker[]>([]);

  const [overridesJson, setOverridesJson] = useLocalSetting(castKey(active?.storyId ?? ""), "");
  const overrides = useMemo(() => readOverrides(overridesJson), [overridesJson]);

  const settings = useRef({ voice, rate, characterVoices, voices, overrides });
  useEffect(() => {
    settings.current = { voice, rate, characterVoices, voices, overrides };
  }, [voice, rate, characterVoices, voices, overrides]);

  const state = useRef({
    run: 0,
    source: null as NarrationSource | null,
    cursor: null as NarrationCursor | null,
    following: true,
    handoff: undefined as ReturnType<typeof setTimeout> | undefined,
    attached: new Set<NarrationSource>(),
  });

  const api = useMemo(() => {
    const s = state.current;

    const follow = (on: boolean) => {
      s.following = on;
      setFollowing(on);
    };

    const show = (source: NarrationSource, { unit }: NarrationCursor) => {
      source.highlight(unit);
      setSpeaker(unit.speaker ? speakerName(source, unit.speaker) : null);
      const found = source.speakers();
      const keys = (list: NarrationSpeaker[]) => list.map(speakerKey).join("\n");
      setSpeakers((was) => (keys(was) === keys(found) ? was : found));
      const blocks = source.blocks();
      const i = unit.kind === "end" ? blocks.length - 1 : blocks.findIndex((b) => b >= unit.block);
      setProgress({ paragraph: (i < 0 ? blocks.length - 1 : i) + 1, paragraphs: blocks.length });
      const rect = s.following ? source.rect(unit) : null;
      if (rect) scrollToRect(source.scroller(), rect, false);
    };

    const release = () => {
      clearTimeout(s.handoff);
      s.handoff = undefined;
      s.run++;
      cancel();
      s.source?.highlight(null);
      s.source = null;
      s.cursor = null;
      setActive(null);
      setSpeaker(null);
    };

    /** The unit as it's said and the voice it's said in: a Character's part in theirs, a cue as a silent pause. */
    const voiced = (source: NarrationSource, unit: NarrationUnit) => {
      const { voice, rate, characterVoices } = settings.current;
      if (!characterVoices || !unit.speaker) return { unit, voice, rate };
      if (unit.kind === "cue") return { unit: { ...unit, speak: "" }, voice, rate };
      const cast = castFor(source, source.speakers(), settings.current).get(speakerKey(unit.speaker));
      return { unit, voice: cast?.voice ?? voice, rate, pitch: cast?.pitch };
    };

    const stop = () => {
      release();
      setStatus("idle");
    };

    const play = async (from: NarrationCursor | null) => {
      const source = s.source;
      if (!source) return stop();
      const run = ++s.run;
      setStatus("playing");
      for (let cursor = from; cursor; cursor = source.next(cursor)) {
        s.cursor = cursor;
        show(source, cursor);
        const { unit, ...how } = voiced(source, cursor.unit);
        const spoken = await speak(unit, how);
        if (run !== s.run) return;
        if (spoken === "blocked") return stop();
      }
      if (!source.onEnd()) return stop();
      release();
      s.handoff = setTimeout(stop, HANDOFF_MS);
    };

    const start = (source: NarrationSource) => {
      release();
      s.source = source;
      setActive(source);
      setTitle(source.title);
      follow(true);
      void play(source.next(null));
    };

    const pause = () => {
      if (!s.cursor) return stop();
      s.run++;
      cancel();
      setStatus("paused");
    };

    const jumpTo = (block: number) => {
      const cursor = s.source?.at(block);
      if (!cursor) return;
      follow(true);
      void play(cursor);
    };

    return {
      start,
      stop,
      pause,
      jumpTo,
      resume: () => void play(s.cursor && s.source?.refresh ? s.source.refresh(s.cursor) : s.cursor),
      /** -1 goes back to this paragraph's start, or the one before if already there; 1 to the next. */
      skip(direction: -1 | 1) {
        const { source, cursor } = s;
        if (!source || !cursor) return;
        const { kind, from } = cursor.unit;
        const block = kind === "end" ? Infinity : cursor.unit.block;
        const blocks = source.blocks();
        if (direction === 1) {
          const next = blocks.find((b) => b > block);
          if (next !== undefined) jumpTo(next);
          return;
        }
        const first = source.at(block);
        if (first && first.unit.block === block && first.unit.from < from) return jumpTo(block);
        const prev = blocks.findLast((b) => b < block);
        jumpTo(prev ?? blocks[0] ?? 0);
      },
      backToReading() {
        follow(true);
        const rect = s.source && s.cursor ? s.source.rect(s.cursor.unit) : null;
        if (rect) scrollToRect(s.source!.scroller(), rect, true);
      },
      attach(source: NarrationSource) {
        s.attached.add(source);
        if (s.handoff) start(source);
        return () => {
          s.attached.delete(source);
          // Deferred, so a remount of the same source (React's Strict Mode) doesn't stop it.
          setTimeout(() => {
            if (s.source === source && !s.attached.has(source)) stop();
          });
        };
      },
      /** Turns following off when you scroll the page yourself; scrolls Narration makes don't count. */
      unfollow: () => s.following && follow(false),
      current: () => (s.source && s.cursor ? { source: s.source, unit: s.cursor.unit } : null),
    };
  }, []);

  const listening = status !== "idle";
  const playing = status === "playing";

  useEffect(() => api.stop, [api]);

  useEffect(() => {
    if (!listening) return;
    const fromPlayer = (e: Event) => e.target instanceof Element && e.target.closest("[data-narration-player]");
    const onScroll = (e: Event) => !fromPlayer(e) && api.unfollow();
    const onKey = (e: KeyboardEvent) => {
      const field = e.target instanceof Element && e.target.closest('input, textarea, select, button, [contenteditable="true"]');
      if (SCROLL_KEYS.has(e.key) && !field) api.unfollow();
    };
    addEventListener("wheel", onScroll, { passive: true });
    addEventListener("touchmove", onScroll, { passive: true });
    addEventListener("keydown", onKey);
    addEventListener("popstate", api.stop);
    return () => {
      removeEventListener("wheel", onScroll);
      removeEventListener("touchmove", onScroll);
      removeEventListener("keydown", onKey);
      removeEventListener("popstate", api.stop);
    };
  }, [listening, api]);

  useEffect(() => {
    if (!listening || following) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = api.current();
        const rect = current?.source.rect(current.unit);
        if (!current || !rect) return;
        const view = viewOf(current.source.scroller());
        setBehind(rect.bottom < (view.top + view.bottom) / 2 ? "up" : "down");
      });
    };
    measure();
    addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", measure, { capture: true });
    };
  }, [listening, following, api]);

  useEffect(() => {
    const container = active?.container();
    if (!active || !container || !listening) return;
    container.dataset.narrating = "";
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !document.getSelection()?.isCollapsed) return;
      const block = active.blockAt(e.target);
      if (block !== null) api.jumpTo(block);
    };
    container.addEventListener("click", onClick);
    return () => {
      delete container.dataset.narrating;
      container.removeEventListener("click", onClick);
    };
  }, [active, listening, api]);

  useEffect(() => {
    if (!playing) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const acquire = () =>
      navigator.wakeLock
        ?.request("screen")
        .then((sentinel) => {
          if (done) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => {});
    const onVisibility = () => {
      // Phones stop speech when the screen goes off, so pause where the sentence began. A desktop tab keeps reading.
      if (document.hidden && matchMedia("(pointer: coarse)").matches) api.pause();
      else if (!document.hidden && (!lock || lock.released)) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    };
  }, [playing, api]);

  const cast = useMemo<CastSpeaker[]>(() => {
    if (!active) return [];
    const reading = castFor(active, speakers, { voices, voice, overrides });
    return speakers.flatMap((speaker) => {
      const key = speakerKey(speaker);
      const name = speakerName(active, speaker);
      const voiceOf = reading.get(key);
      if (!name || !voiceOf) return [];
      const cast = "entryId" in speaker ? (active.characters.find((c) => c.id === speaker.entryId)?.voice ?? NO_VOICE) : null;
      return [{ key, name, cast, reading: voiceOf, overridden: voiceOf.voice !== null && voiceOf.voice.name === overrides[key] }];
    });
  }, [active, speakers, voices, voice, overrides]);

  const value: Narration = {
    support,
    status,
    active,
    title,
    ...progress,
    following,
    behind,
    voices,
    voice,
    setVoice: setVoiceName,
    characterVoices,
    setCharacterVoices,
    speaker,
    cast,
    setOverride(key, voiceName) {
      const next = { ...overrides };
      if (voiceName) next[key] = voiceName;
      else delete next[key];
      setOverridesJson(Object.keys(next).length ? JSON.stringify(next) : "");
    },
    rate,
    setRate: (next) => setRateIndex(Math.max(0, RATES.indexOf(next))),
    start: api.start,
    pause: api.pause,
    resume: api.resume,
    stop: api.stop,
    skip: api.skip,
    jumpTo: api.jumpTo,
    backToReading: api.backToReading,
    attach: api.attach,
  };

  return <NarrationContext value={value}>{children}</NarrationContext>;
}
