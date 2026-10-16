"use client";

import { isEnglish } from "@/lib/narration/voices";
import { Dropdown } from "../Dropdown";
import { PauseIcon, PlayIcon, SkipIcon, StopIcon } from "../icons";
import { RATES, useNarration } from "./NarrationProvider";
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

function Voices() {
  const { voices, voice, setVoice } = useNarration();
  const english = voices.filter(isEnglish);
  const others = voices.filter((v) => !isEnglish(v));
  const row = (v: SpeechSynthesisVoice) => (
    <button
      key={v.voiceURI}
      type="button"
      className={styles.row}
      aria-pressed={v === voice}
      data-close
      onClick={() => setVoice(v.name)}
    >
      {v.name}
      <span className={styles.lang}>{v.lang}</span>
    </button>
  );

  return (
    <>
      <p className={styles.heading}>Voice</p>
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
