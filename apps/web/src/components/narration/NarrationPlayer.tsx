"use client";

import { useEffect, useRef, useState } from "react";
import { isEnglish } from "@/lib/narration/voices";
import { Dropdown } from "../Dropdown";
import { Switch } from "../Switch";
import { PauseIcon, PlayIcon, SkipIcon, StopIcon } from "../icons";
import { RATES, useNarration, type CastSpeaker } from "./NarrationProvider";
import styles from "./NarrationPlayer.module.css";

const rateLabel = (rate: number) => `${rate}×`;

/** The controls while Narration is on. `sticky` pins it to the bottom of the window, for the Reader View. */
export function NarrationPlayer({ sticky = false }: { sticky?: boolean }) {
  const narration = useNarration();
  const { status, rate, setRate } = narration;
  if (status === "idle") return null;

  const playing = status === "playing";
  const nextRate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]!;

  return (
    <div className={`${styles.player} ${sticky ? styles.sticky : ""}`} role="region" aria-label="Narration" data-narration-player>
      {!narration.following && (
        <button type="button" className={`button button-small ${styles.back}`} onClick={narration.backToReading}>
          <span aria-hidden>{narration.behind === "up" ? "↑" : "↓"}</span> Back to reading
        </button>
      )}
      <div className={styles.transport}>
        <button
          type="button"
          className={styles.icon}
          aria-label="Previous paragraph"
          data-tip="Previous paragraph"
          onClick={() => narration.skip(-1)}
        >
          <SkipIcon />
        </button>
        <button
          type="button"
          className={`${styles.icon} ${styles.play}`}
          aria-label={playing ? "Pause" : "Play"}
          onClick={playing ? narration.pause : narration.resume}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className={styles.icon}
          aria-label="Next paragraph"
          data-tip="Next paragraph"
          onClick={() => narration.skip(1)}
        >
          <SkipIcon next />
        </button>
      </div>

      <div className={styles.where} aria-live="polite">
        <span className={styles.title}>{narration.title}</span>
        {narration.paragraphs > 0 && (
          <span className={styles.progress}>
            Reading paragraph {narration.paragraph} of {narration.paragraphs}
            {narration.speaker && ` · ${narration.speaker}`}
          </span>
        )}
      </div>

      <div className={styles.settings}>
        <button
          type="button"
          className={`button button-ghost button-small ${styles.rate} ${styles.wide}`}
          aria-label={`Speed ${rateLabel(rate)}`}
          data-tip={`Speed: ${rateLabel(nextRate)} next`}
          onClick={() => setRate(nextRate)}
        >
          {rateLabel(rate)}
        </button>
        <Dropdown
          label="Voice"
          className={styles.wide}
          trigger={
            <>
              Voice <span aria-hidden>&#9652;</span>
            </>
          }
          triggerClassName="button button-ghost button-small"
          panelClassName={styles.menu}
        >
          <Voices />
        </Dropdown>
        <Dropdown
          label="Speed and voice"
          className={styles.narrow}
          trigger={rateLabel(rate)}
          triggerClassName={`button button-ghost button-small ${styles.rate}`}
          panelClassName={styles.menu}
        >
          <p className={styles.heading}>Speed</p>
          <div className={styles.rates}>
            {RATES.map((r) => (
              <button key={r} type="button" aria-pressed={r === rate} onClick={() => setRate(r)}>
                {rateLabel(r)}
              </button>
            ))}
          </div>
          <Voices />
        </Dropdown>
      </div>

      <button
        type="button"
        className="button button-ghost button-small with-icon"
        onClick={narration.stop}
        data-tip="Stop"
      >
        <StopIcon />
        <span className="with-icon-label">Stop</span>
      </button>
    </div>
  );
}

/** "Masculine, lower", or why a speaker has no Voice to cast. */
function castHint({ cast }: CastSpeaker) {
  if (!cast) return "Not in the Story Bible";
  const kind = cast.kind === "feminine" ? "Feminine" : cast.kind === "masculine" ? "Masculine" : "Any";
  return cast.pitch === 0 ? kind : `${kind}, ${cast.pitch < 0 ? "lower" : "higher"}`;
}

/**
 * The Voice menu: the Character voices switch, the Chapter's speakers, and the narrator's voice. A speaker opens
 * their own list of voices in place, where "As cast" drops the listener's pick.
 */
function Voices() {
  const narration = useNarration();
  const { voice, setVoice, characterVoices, cast } = narration;
  const [casting, setCasting] = useState<string | null>(null);
  const speaker = characterVoices ? cast.find((c) => c.key === casting) : undefined;
  const back = useRef<HTMLButtonElement>(null);
  const opened = useRef<string | null>(null);

  // Swapping lists unmounts the focused row, so focus moves to its counterpart in the other list.
  useEffect(() => {
    if (casting) back.current?.focus();
    else if (opened.current) document.querySelector<HTMLElement>(`[data-speaker="${CSS.escape(opened.current)}"]`)?.focus();
  }, [casting]);

  if (speaker) {
    // The menu closes on a pick, and opens again on the speakers.
    const pick = (voiceName: string | null) => {
      narration.setOverride(speaker.key, voiceName);
      opened.current = null;
      setCasting(null);
    };

    return (
      <>
        <button ref={back} type="button" className={styles.row} onClick={() => setCasting(null)}>
          <span>
            <span aria-hidden>&larr; </span>
            {speaker.name}
          </span>
        </button>
        <button
          type="button"
          className={styles.row}
          aria-pressed={!speaker.overridden}
          data-close
          onClick={() => pick(null)}
        >
          As cast
          <span className={styles.lang}>{castHint(speaker)}</span>
        </button>
        <VoiceList
          selected={speaker.overridden ? speaker.reading.voice : null}
          onPick={(v) => pick(v.name)}
        />
      </>
    );
  }

  return (
    <>
      <Switch checked={characterVoices} onChange={narration.setCharacterVoices} className={styles.switch}>
        Character voices
      </Switch>
      {characterVoices && cast.length > 0 && (
        <>
          <p className={styles.heading}>Characters in this Chapter</p>
          {cast.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`${styles.row} ${styles.speaker}`}
              data-speaker={c.key}
              onClick={() => {
                opened.current = c.key;
                setCasting(c.key);
              }}
            >
              <span className={styles.speakerName}>{c.name}</span>
              <span className={styles.lang}>
                {c.reading.voice?.name ?? "No voice"} · {c.overridden ? "Your pick" : castHint(c)}
              </span>
            </button>
          ))}
        </>
      )}
      <VoiceList heading={characterVoices ? "Narrator" : "Voice"} selected={voice} onPick={(v) => setVoice(v.name)} />
    </>
  );
}

function VoiceList({
  heading = "Voice",
  selected,
  onPick,
}: {
  heading?: string;
  selected: SpeechSynthesisVoice | null;
  onPick: (voice: SpeechSynthesisVoice) => void;
}) {
  const { voices } = useNarration();
  const english = voices.filter(isEnglish);
  const others = voices.filter((v) => !isEnglish(v));
  const row = (v: SpeechSynthesisVoice) => (
    <button
      key={v.voiceURI}
      type="button"
      className={styles.row}
      aria-pressed={v === selected}
      data-close
      onClick={() => onPick(v)}
    >
      {v.name}
      <span className={styles.lang}>{v.lang}</span>
    </button>
  );

  return (
    <>
      <p className={styles.heading}>{heading}</p>
      {english.map(row)}
      {others.length > 0 && (
        <>
          <p className={styles.heading}>More languages</p>
          {others.map(row)}
        </>
      )}
    </>
  );
}
