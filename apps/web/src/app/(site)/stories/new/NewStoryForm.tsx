"use client";

import { useRef, useState } from "react";
import { createStory, importStory } from "@/lib/actions/stories";
import { ENTRY_GROUP_LABEL, ENTRY_TYPE_LABEL } from "@/lib/entries";
import { fromMarkdown } from "@/lib/story-file/markdown";
import { IMPORT_MAX_BYTES, IMPORT_MAX_CHAPTERS } from "@/lib/story-file/import";
import { summarize, type StorySummary } from "@/lib/story-file/summary";
import { ActionForm } from "@/components/ActionForm";
import { StoryFields } from "@/components/StoryFields";
import styles from "./new.module.css";

type Picked = { name: string; size: number } & (
  | { title: string; blurb: string; summary: StorySummary; warnings: string[] }
  | { error: string }
);

const ACCEPT = ".md,.markdown,.txt,text/markdown,text/plain";
const UNREADABLE = "Couldn't read this file. Choose a Markdown (.md) or plain text (.txt) file.";

const number = new Intl.NumberFormat("en-US");
const kilobytes = new Intl.NumberFormat("en-US", { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 });
const megabytes = new Intl.NumberFormat("en-US", { style: "unit", unit: "megabyte", maximumFractionDigits: 1 });

/** The New Story form: Blank, or Start from a file, which is read here to summarize it and prefill the title and Blurb. */
export function NewStoryForm({ initialFromFile = false }: { initialFromFile?: boolean }) {
  const [fromFile, setFromFile] = useState(initialFromFile);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const tabs = useRef<HTMLDivElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return setPicked(null);
    const { name, size } = file;
    // Dropped files skip the input's accept filter.
    if (!/\.(md|markdown|txt)$/i.test(name) && !/^text\/(markdown|plain)$/.test(file.type)) {
      return setPicked({ name, size, error: UNREADABLE });
    }
    if (size > IMPORT_MAX_BYTES) return setPicked({ name, size, error: "This file is over 2 MB, too big to import." });
    try {
      const { file: story, warnings } = fromMarkdown(await file.text(), name);
      const summary = summarize(story);
      if (summary.chapters > IMPORT_MAX_CHAPTERS) {
        return setPicked({
          name,
          size,
          error: `This file has ${number.format(summary.chapters)} Chapters. A Story can import up to ${IMPORT_MAX_CHAPTERS}.`,
        });
      }
      setPicked({ name, size, title: story.title, blurb: story.blurb, summary, warnings });
    } catch {
      setPicked({ name, size, error: UNREADABLE });
    }
  }

  function dragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  }

  function dragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  }

  function drop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file || !fileInput.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.current.files = transfer.files;
    pick(file);
  }

  function switchTab(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setFromFile(!fromFile);
    tabs.current?.querySelector<HTMLButtonElement>(`[aria-selected="false"]`)?.focus();
  }

  const tab = (file: boolean, label: string) => (
    <button
      type="button"
      role="tab"
      id={file ? "new-file-tab" : "new-blank-tab"}
      className="tab"
      aria-selected={fromFile === file}
      aria-controls="new-panel"
      tabIndex={fromFile === file ? 0 : -1}
      onClick={() => setFromFile(file)}
      onKeyDown={switchTab}
    >
      {label}
    </button>
  );

  return (
    <>
      <div ref={tabs} role="tablist" aria-label="Start from" className="tabs">
        {tab(false, "Blank")}
        {tab(true, "Start from a file")}
      </div>

      <div role="tabpanel" id="new-panel" aria-labelledby={fromFile ? "new-file-tab" : "new-blank-tab"}>
        {!fromFile ? (
          <ActionForm action={createStory} className={styles.form}>
            <StoryFields />
            <div>
              <button className="button button-primary">Create story</button>
            </div>
          </ActionForm>
        ) : (
          // React resets the form after a failed import, which empties the file input.
          <div onReset={() => setPicked(null)}>
            <ActionForm action={importStory} className={styles.form}>
              <div>
                <input
                  ref={fileInput}
                  type="file"
                  id="import-file"
                  name="file"
                  accept={ACCEPT}
                  className={`sr-only ${styles.fileInput}`}
                  onChange={(e) => pick(e.target.files?.[0])}
                />
                {!picked ? (
                  <label
                    htmlFor="import-file"
                    className={styles.drop}
                    data-dragging={dragging || undefined}
                    onDragEnter={dragOver}
                    onDragOver={dragOver}
                    onDragLeave={dragLeave}
                    onDrop={drop}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden>
                      <path d="M10 13V4M6 7.5 10 4l4 3.5M4 13v2.5h12V13" />
                    </svg>
                    <strong>{dragging ? "Drop to import" : "Drop a Markdown or text file here"}</strong>
                    <span className={`button button-small ${styles.dropButton}`}>Choose a file</span>
                    <span className={`muted ${styles.dropHint}`}>
                      A Coscribe Export fills in the title and Blurb for you. Headings become Chapters.
                    </span>
                  </label>
                ) : (
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.fileName}>{picked.name}</span>
                      <span className={`muted ${styles.fileSize}`}>{fileSize(picked.size)}</span>
                      <label htmlFor="import-file" className="button button-ghost button-small">
                        Choose another
                      </label>
                    </div>
                    <div className={styles.cardBody}>
                      {"error" in picked ? (
                        <p role="alert" className={styles.error}>
                          {picked.error}
                        </p>
                      ) : (
                        <ImportSummary summary={picked.summary} warnings={picked.warnings} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <label className="choice">
                <input type="checkbox" name="mine" defaultChecked />
                <span>
                  I wrote this <span className="muted">&mdash; credit the text to me</span>
                </span>
              </label>

              <StoryFields
                key={picked?.name}
                title={picked && "title" in picked ? picked.title : ""}
                blurb={picked && "blurb" in picked ? picked.blurb : ""}
              />
              <div>
                <button className="button button-primary" disabled={!picked || "error" in picked}>
                  Import story
                </button>
              </div>
            </ActionForm>
          </div>
        )}
      </div>
    </>
  );
}

function ImportSummary({ summary, warnings }: { summary: StorySummary; warnings: string[] }) {
  const entries = summary.entries.reduce((sum, group) => sum + group.count, 0);
  const groups = summary.entries
    .map(({ type, count }) => `${count} ${count === 1 ? ENTRY_TYPE_LABEL[type] : ENTRY_GROUP_LABEL[type]}`)
    .join(", ");
  return (
    <>
      <ul>
        <li>
          {plural(summary.chapters, "Chapter")}, {plural(summary.words, "word")}
        </li>
        {entries > 0 && (
          <li>
            {plural(entries, "Story Bible Entry", "Story Bible Entries")} ({groups})
          </li>
        )}
        {summary.outlines > 0 && <li>Outlines for {plural(summary.outlines, "Chapter")}</li>}
        {summary.scripts > 0 && <li>{plural(summary.scripts, "Script")}</li>}
      </ul>
      <p className="muted">
        {summary.chapters > 1 ? "First Chapters" : "Chapter"}: {summary.firstChapters.join(", ")}
        {summary.chapters > summary.firstChapters.length && "…"}
      </p>
      {warnings.map((warning) => (
        <p key={warning} className="muted">
          {warning}
        </p>
      ))}
    </>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${number.format(n)} ${n === 1 ? one : many}`;
}

function fileSize(bytes: number) {
  return bytes < 1_000_000 ? kilobytes.format(Math.max(1, bytes / 1000)) : megabytes.format(bytes / 1_000_000);
}
