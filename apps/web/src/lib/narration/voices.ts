"use client";

import { useSyncExternalStore } from "react";

type Voice = Pick<SpeechSynthesisVoice, "name" | "lang">;

export type VoiceSupport = "loading" | "ok" | "none";

/** How long to wait for `voiceschanged` before deciding this browser has no voices. */
const VOICES_TIMEOUT_MS = 3000;

export const isEnglish = (voice: Voice) => voice.lang.toLowerCase().startsWith("en");

/** The neural voices Edge, Chrome and Safari name "Natural", "Online", "Neural" or "Enhanced"/"Premium". */
const isNatural = (voice: Voice) => /\b(natural|online|neural|enhanced|premium)\b/i.test(voice.name);

/** English voices first, then the rest; within each, the natural-sounding ones first, then by name. */
export function sortVoices<V extends Voice>(voices: readonly V[]): V[] {
  const rank = (v: V) => (isEnglish(v) ? 0 : 2) + (isNatural(v) ? 0 : 1);
  return [...voices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
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
