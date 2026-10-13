"use client";

import { useState } from "react";
import { Dropdown } from "./Dropdown";
import { Switch } from "./Switch";
import styles from "./ExportMenu.module.css";

const FORMATS = [
  { format: "epub", label: "EPUB", hint: "for e-readers" },
  { format: "md", label: "Markdown", hint: "plain text, and Import" },
] as const;

/**
 * The Download menu: the Story as EPUB or Markdown, or the print page in a new tab, with or without its Story Bible,
 * and for a Draft Export its Outlines. Downloads are fetched rather than linked, so a failure shows here instead of as a
 * bare error page.
 */
export function ExportMenu({
  storyId,
  finished,
  hasEntries,
  align = "start",
}: {
  storyId: string;
  finished: boolean;
  hasEntries: boolean;
  align?: "start" | "end";
}) {
  const [bible, setBible] = useState(true);
  const [outlines, setOutlines] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const options = { bible: bible && hasEntries ? "1" : "0", outlines: outlines && !finished ? "1" : "0" };

  async function download(format: "epub" | "md") {
    setBusy(true);
    setFailed(false);
    try {
      const query = new URLSearchParams({ format, ...options });
      const response = await fetch(`/stories/${storyId}/export?${query}`);
      if (!response.ok) throw new Error(`export failed: ${response.status}`);
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name ?? `story.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={styles.wrap}>
      <Dropdown
        label="Download"
        trigger={
          <>
            {busy ? "Preparing…" : "Download"} <span aria-hidden>&#9662;</span>
          </>
        }
        triggerClassName="button"
        panelClassName={styles.menu}
        align={align}
      >
        {!finished && <p className={styles.heading}>A Draft Export of the Story as it is now.</p>}
        {FORMATS.map(({ format, label, hint }) => (
          <button
            key={format}
            type="button"
            className={styles.row}
            data-close
            disabled={busy}
            onClick={() => download(format)}
          >
            {label}
            <span className={styles.hint}>{hint}</span>
          </button>
        ))}
        <a
          href={`/stories/${storyId}/print?${new URLSearchParams(options)}`}
          target="_blank"
          className={styles.row}
        >
          Print or save as PDF
        </a>
        {(hasEntries || !finished) && <hr className={styles.divider} />}
        {hasEntries && (
          <Switch checked={bible} onChange={setBible} className={styles.row}>
            Include the Story Bible
          </Switch>
        )}
        {!finished && (
          <Switch checked={outlines} onChange={setOutlines} className={styles.row}>
            Include Outlines
          </Switch>
        )}
      </Dropdown>
      {failed && (
        <p role="alert" className={styles.error}>
          Couldn&rsquo;t load the text, try again.
        </p>
      )}
    </span>
  );
}
