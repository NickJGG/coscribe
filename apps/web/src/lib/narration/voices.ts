"use client";

import { useSyncExternalStore } from "react";
import type { EntryVoice, VoiceKind, VoicePitch } from "@/lib/entries";

type Voice = Pick<SpeechSynthesisVoice, "name" | "lang">;

export type VoiceSupport = "loading" | "ok" | "none";

/** How long to wait for `voiceschanged` before deciding this browser has no voices. */
const VOICES_TIMEOUT_MS = 3000;

export const isEnglish = (voice: Voice) => voice.lang.toLowerCase().startsWith("en");

/** The neural voices Edge, Chrome and Safari name "Natural", "Online", "Neural" or "Enhanced"/"Premium". */
export const isNatural = (voice: Voice) => /\b(natural|online|neural|enhanced|premium)\b/i.test(voice.name);

/** English voices first, then the rest; within each, the natural-sounding ones first, then by name. */
export function sortVoices<V extends Voice>(voices: readonly V[]): V[] {
  const rank = (v: V) => (isEnglish(v) ? 0 : 2) + (isNatural(v) ? 0 : 1);
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

const FEMININE = new Set(
  [
    // Edge and Azure "Online (Natural)"
    "Aria", "Jenny", "Michelle", "Sonia", "Libby", "Natasha", "Clara", "Emily", "Ana", "Ava", "Emma", "Sara", "Nancy",
    "Jane", "Amber", "Ashley", "Cora", "Elizabeth", "Monica", "Leah", "Molly", "Neerja", "Rosa", "Mia", "Maisie",
    "Hollie", "Bella", "Abbi", "Olivia", "Yan", "Luna", "Katja", "Denise", "Elvira", "Elsa", "Isabella", "Nanami",
    "Xiaoxiao", "Francisca", "Dalia", "Vivienne", "Seraphina", "Amala", "Ximena",
    // Windows
    "Zira", "Hazel", "Susan", "Heera", "Linda", "Catherine", "Hedda", "Helena", "Hortense", "Julie", "Haruka",
    // Apple
    "Samantha", "Karen", "Moira", "Tessa", "Victoria", "Allison", "Zoe", "Fiona", "Veena", "Kate", "Serena", "Nicky",
    "Joelle", "Shelley", "Sandy", "Flo", "Grandma", "Amelie", "Amélie", "Anna", "Paulina", "Alice", "Luciana", "Kyoko",
    "Yuna", "Tingting", "Milena", "Ellen", "Zuzana", "Sinji", "Meijia", "Kanya", "Damayanti", "Lekha", "Mariska",
  ].map((n) => n.toLowerCase())
);

const MASCULINE = new Set(
  [
    // Edge and Azure "Online (Natural)"
    "Guy", "Davis", "Ryan", "Thomas", "William", "Christopher", "Eric", "Roger", "Steffan", "Andrew", "Brian", "Tony",
    "Jason", "Jacob", "Brandon", "Liam", "Mitchell", "Connor", "Prabhat", "Wayne", "Ethan", "Elliot", "Alfie", "Noah",
    "Kai", "Luke", "Ken", "Conrad", "Killian", "Henri", "Remy", "Alvaro", "Diego", "Keita", "Yunxi", "Antonio",
    "Giuseppe", "Jorge", "Dario", "Florian", "Ollie",
    // Windows
    "David", "Mark", "George", "Richard", "Sean", "Ravi", "James", "Stefan", "Paul", "Pablo", "Ichiro",
    // Apple
    "Alex", "Daniel", "Fred", "Rishi", "Tom", "Oliver", "Aaron", "Arthur", "Gordon", "Lee", "Evan", "Nathan", "Ralph",
    "Albert", "Reed", "Rocko", "Eddy", "Grandpa", "Junior", "Juan", "Luca", "Felipe", "Xander", "Maged", "Yuri",
    "Otoya", "Jacques", "Nicolas", "Aman",
  ].map((n) => n.toLowerCase())
);

/**
 * Whether a voice sounds feminine or masculine, from a table of the names Edge, Windows, Chrome and Apple give
 * their voices (the first word after the vendor), or null when it isn't known, as with Android's coded names.
 */
export function voiceKind(voice: Voice): VoiceKind | null {
  if (/\bfemale\b/i.test(voice.name) || /^Google US English$/i.test(voice.name)) return "feminine";
  if (/\bmale\b/i.test(voice.name)) return "masculine";
  const first = voice.name.replace(/^(microsoft|google|apple)\s+/i, "").split(/[\s(,-]/u)[0].toLowerCase().replace(/multilingual$/u, "");
  if (FEMININE.has(first)) return "feminine";
  if (MASCULINE.has(first)) return "masculine";
  return null;
}

/** `utterance.pitch` for each Voice pitch. */
export const PITCH: Record<VoicePitch, number> = { [-1]: 0.85, 0: 1, 1: 1.15 };

/** Pitch shifts that tell apart speakers who share a voice once a Chapter's speakers outnumber the voices. */
const REUSE_PITCH = [1, 0.92, 1.08, 0.84, 1.16];

/** The narrator voice for a saved name: that voice, else the first one. */
export function narratorVoice<V extends Voice>(voices: readonly V[], name: string): V | null {
  return voices.find((v) => v.name === name) ?? voices[0] ?? null;
}

const language = (voice: Voice) => voice.lang.toLowerCase().split(/[-_]/u)[0];

function hash(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export type CastVoice<V> = { voice: V | null; pitch: number };

/**
 * A voice and pitch for each speaker in a Chapter. A listener's override (a voice name) wins; otherwise each
 * speaker gets an automatic voice, other than the narrator's and of its cast kind where any voice is known to
 * be one. Automatic voices come from the narrator's language when it has any besides the narrator, natural-sounding
 * ones first. The pick starts where the speaker's key hashes to, so it's the same every time, and skips voices
 * other speakers already have; once every voice is taken they're shared again at a shifted pitch. The cast
 * pitch applies on top of all of it.
 */
export function castVoices<V extends Voice>({
  speakers,
  voices,
  narrator,
  cast = {},
  overrides = {},
}: {
  /** Speaker keys, in the order they first speak. */
  speakers: readonly string[];
  voices: readonly V[];
  narrator: V | null;
  cast?: Readonly<Record<string, EntryVoice>>;
  overrides?: Readonly<Record<string, string>>;
}): Map<string, CastVoice<V>> {
  const result = new Map<string, CastVoice<V>>();
  const castPitch = (key: string) => PITCH[cast[key]?.pitch ?? 0];
  const taken = new Set<string>();
  const auto: string[] = [];

  for (const key of speakers) {
    const voice = overrides[key] ? voices.find((v) => v.name === overrides[key]) : undefined;
    if (voice) {
      result.set(key, { voice, pitch: castPitch(key) });
      taken.add(`${voice.name}\n0`);
    } else {
      auto.push(key);
    }
  }

  const others = voices.filter((v) => v.name !== narrator?.name);
  const sameLanguage = narrator ? others.filter((v) => language(v) === language(narrator)) : [];
  const pool = sameLanguage.length ? sameLanguage : others;
  const tiers = (candidates: V[]) => {
    const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));
    return [sorted.filter(isNatural), sorted.filter((v) => !isNatural(v))].filter((t) => t.length);
  };
  const anyTiers = tiers(pool);
  const kindTiers = {
    feminine: tiers(pool.filter((v) => voiceKind(v) === "feminine")),
    masculine: tiers(pool.filter((v) => voiceKind(v) === "masculine")),
  };

  for (const key of auto) {
    const kind = cast[key]?.kind;
    const choices = (kind && kindTiers[kind].length ? kindTiers[kind] : anyTiers).concat(
      pool.length ? [] : narrator ? [[narrator]] : []
    );
    const start = hash(key);
    let picked: CastVoice<V> = { voice: narrator, pitch: castPitch(key) };
    // The narrator only ever reads a speaker's part at a shifted pitch.
    search: for (let round = pool.length ? 0 : 1; round < REUSE_PITCH.length; round++) {
      for (const tier of choices) {
        for (let i = 0; i < tier.length; i++) {
          const voice = tier[(start + i) % tier.length];
          if (taken.has(`${voice.name}\n${round}`)) continue;
          taken.add(`${voice.name}\n${round}`);
          picked = { voice, pitch: REUSE_PITCH[round] * castPitch(key) };
          break search;
        }
      }
    }
    result.set(key, picked);
  }
  return result;
}

type Voices = { voices: SpeechSynthesisVoice[]; support: VoiceSupport };

const LOADING: Voices = { voices: [], support: "loading" };
let current = LOADING;
let watching = false;
const listeners = new Set<() => void>();

function set(next: Voices) {
  current = next;
  listeners.forEach((listener) => listener());
}

function load() {
  const found = speechSynthesis.getVoices();
  if (found.length) set({ voices: sortVoices(found), support: "ok" });
}

/** Starts watching on first use and never stops: voices only change when the browser installs some. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching) {
    watching = true;
    if (!("speechSynthesis" in window)) {
      set({ voices: [], support: "none" });
    } else {
      speechSynthesis.addEventListener("voiceschanged", load);
      load();
      setTimeout(() => current.support === "loading" && set({ voices: [], support: "none" }), VOICES_TIMEOUT_MS);
    }
  }
  return () => listeners.delete(listener);
}

/** This browser's voices, sorted, and whether it can read aloud at all. */
export function useVoices(): Voices {
  return useSyncExternalStore(subscribe, () => current, () => LOADING);
}
