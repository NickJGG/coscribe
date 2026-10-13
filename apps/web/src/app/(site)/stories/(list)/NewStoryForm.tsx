"use client";

import { useState } from "react";
import { createStory, importStory } from "@/lib/actions/stories";
import { ENTRY_GROUP_LABEL, ENTRY_TYPE_LABEL } from "@/lib/entries";
import { fromMarkdown } from "@/lib/story-file/markdown";
import { IMPORT_MAX_BYTES, IMPORT_MAX_CHAPTERS } from "@/lib/story-file/import";
import { summarize, type StorySummary } from "@/lib/story-file/summary";
import { ActionForm } from "@/components/ActionForm";
import { StoryFields } from "@/components/StoryFields";
import styles from "./stories.module.css";

type Picked =
  | { name: string; title: string; blurb: string; summary: StorySummary; warnings: string[] }
  | { name: string; error: string };

const number = new Intl.NumberFormat("en-US");

/** The New Story form: Blank, or Start from a file, which is read here to summarize it and prefill the title and Blurb. */
export function NewStoryForm() {
  const [fromFile, setFromFile] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return setPicked(null);
    if (file.size > IMPORT_MAX_BYTES) return setPicked({ name: file.name, error: "This file is over 2 MB, too big to import." });
    try {
      const { file: story, warnings } = fromMarkdown(await file.text(), file.name);
      const summary = summarize(story);
      if (summary.chapters > IMPORT_MAX_CHAPTERS) {
        return setPicked({
          name: file.name,
          error: `This file has ${number.format(summary.chapters)} Chapters. A Story can import up to ${IMPORT_MAX_CHAPTERS}.`,
        });
      }
      setPicked({ name: file.name, title: story.title, blurb: story.blurb, summary, warnings });
    } catch {
      setPicked({ name: file.name, error: "Couldn't read this file. Choose a Markdown (.md) or plain text (.txt) file." });
    }
  }

  return (
    <>
      <span className="segmented" role="group" aria-label="Start from">
        <button type="button" aria-pressed={!fromFile} onClick={() => setFromFile(false)}>
          Blank
        </button>
        <button type="button" aria-pressed={fromFile} onClick={() => setFromFile(true)}>
          Start from a file
        </button>
      </span>

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
            <label className={styles.drop}>
              <input
                type="file"
                name="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <strong>{picked ? picked.name : "Choose a Markdown or text file"}</strong>
              <span className="muted">
                {picked
                  ? "Choose another file"
                  : "A Coscribe Export fills in the title and Blurb for you. Headings become Chapters."}
              </span>
            </label>

            {picked &&
              ("error" in picked ? (
                <p role="alert" className={styles.importError}>
                  {picked.error}
                </p>
              ) : (
                <ImportSummary summary={picked.summary} warnings={picked.warnings} />
              ))}

            <label className={styles.check}>
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
    </>
  );
}

function ImportSummary({ summary, warnings }: { summary: StorySummary; warnings: string[] }) {
  const entries = summary.entries.reduce((sum, group) => sum + group.count, 0);
  const groups = summary.entries
    .map(({ type, count }) => `${count} ${count === 1 ? ENTRY_TYPE_LABEL[type] : ENTRY_GROUP_LABEL[type]}`)
    .join(", ");
  return (
    <div className={styles.summary}>
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
    </div>
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${number.format(n)} ${n === 1 ? one : many}`;
}
