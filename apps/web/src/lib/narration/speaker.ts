"use client";

import type { NarrationUnit } from "@coscribe/editor";

/** How a unit's turn ended: read through, cut off by `cancel()`, or refused by the browser (no user gesture yet). */
export type Spoken = "done" | "cancelled" | "blocked";

let utterance: SpeechSynthesisUtterance | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let settle: ((result: Spoken) => void) | null = null;

function finish(result: Spoken) {
  const resolve = settle;
  settle = null;
  resolve?.(result);
}

/**
 * Speaks one unit as its own utterance, then waits out its pause (shorter at higher rates). One utterance per
 * sentence keeps Chrome from cutting long ones off, and makes pausing and jumping exact: Narration pauses by
 * cancelling and later says the sentence again, since `speechSynthesis.pause()` is unreliable across browsers.
 */
export function speak(
  unit: NarrationUnit,
  { voice, rate, pitch = 1 }: { voice: SpeechSynthesisVoice | null; rate: number; pitch?: number }
) {
  cancel();
  return new Promise<Spoken>((resolve) => {
    settle = resolve;
    const pause = () => {
      timer = setTimeout(() => finish("done"), unit.pauseAfterMs / rate);
    };
    if (!unit.speak) return pause();

    const u = new SpeechSynthesisUtterance(unit.speak);
    u.voice = voice;
    if (voice) u.lang = voice.lang;
    u.rate = rate;
    u.pitch = pitch;
    u.onend = () => {
      if (utterance !== u) return;
      utterance = null;
      pause();
    };
    u.onerror = (e) => {
      if (utterance !== u) return;
      utterance = null;
      if (e.error === "not-allowed") finish("blocked");
      else if (e.error === "interrupted" || e.error === "canceled") finish("cancelled");
      // A voice that fails on one sentence shouldn't stop the rest.
      else pause();
    };
    // Kept in a module variable: Chrome drops the end event of an utterance that's been garbage collected.
    utterance = u;
    speechSynthesis.speak(u);
  });
}

export function cancel() {
  clearTimeout(timer);
  const speaking = utterance !== null;
  utterance = null;
  finish("cancelled");
  if (speaking && "speechSynthesis" in window) speechSynthesis.cancel();
}
