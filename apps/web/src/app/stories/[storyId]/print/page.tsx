import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { getExport } from "@/lib/export";
import { ENTRY_GROUP_LABEL, entryGroups } from "@/lib/entries";
import { ProseView } from "@/components/ProseView";
import { Unavailable } from "../read/Unavailable";
import { PrintButton } from "./PrintButton";
import scriptStyles from "@/components/Script.module.css";
import reader from "../read/reader.module.css";
import styles from "./print.module.css";

export async function generateMetadata(props: PageProps<"/stories/[storyId]/print">): Promise<Metadata> {
  const data = await getStory((await props.params).storyId);
  // The browser names a saved PDF after the page title.
  return { title: { absolute: data?.story.title || "Story" }, robots: { index: false } };
}

const finishedOn = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const exportedOn = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" });
const listFormat = new Intl.ListFormat("en", { type: "conjunction" });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

/**
 * The whole book on one page for the browser's print dialog: title page, Chapters (each on a new sheet, Outlines first
 * when asked), Story Bible, Credits. `?bible=0` leaves out the Story Bible, `outlines=1` adds Outlines to a Draft.
 */
export default async function PrintPage(props: PageProps<"/stories/[storyId]/print">) {
  const { storyId } = await props.params;
  const { bible, outlines } = await props.searchParams;
  const file = await getExport(storyId, { bible: bible !== "0", outlines: outlines === "1" });
  if (file === "forbidden") notFound();

  if (file === "unavailable") {
    return (
      <div className={reader.page}>
        <Unavailable />
      </div>
    );
  }

  const date =
    file.status === "finished"
      ? file.finished && `Finished ${finishedOn.format(new Date(file.finished))}`
      : `Draft, exported ${exportedOn.format(new Date(file.exported))}`;
  const typeOrder = [...new Set(file.entries.map((e) => e.type))];

  return (
    <div className={`${reader.page} ${styles.book}`}>
      <PrintButton />

      <header className={`${reader.titlePage} ${styles.titlePage}`}>
        <h1 className={reader.bookTitle}>{file.title}</h1>
        {file.blurb && <p className={reader.blurb}>{file.blurb}</p>}
        {file.byline?.length ? <p className={reader.byline}>by {listFormat.format(file.byline)}</p> : null}
        {date && <p className="muted">{date}</p>}
      </header>

      {file.chapters.map((chapter, i) => (
        <section key={i} className={styles.sheet}>
          <header className={reader.chapterHead}>
            <p className={reader.eyebrow}>Chapter {i + 1}</p>
            <h2 className={reader.chapterTitle}>{chapter.title}</h2>
          </header>
          {chapter.outline && (chapter.outline.fields.length > 0 || chapter.outline.characters.length > 0) && (
            <section className={styles.outline}>
              <h3 className={reader.eyebrow}>Outline</h3>
              {chapter.outline.characters.length > 0 && (
                <p className="muted">Characters: {chapter.outline.characters.join(", ")}</p>
              )}
              {chapter.outline.fields.map((field, j) => (
                <div key={j} className={styles.field}>
                  <h4>{field.label}</h4>
                  <div className={`${reader.text} ${styles.fieldText}`}>
                    <ProseView content={field.content} />
                  </div>
                </div>
              ))}
            </section>
          )}
          {chapter.content.content?.length ? (
            <div className={`${reader.text} ${scriptStyles.scripts}`}>
              <ProseView content={chapter.content} />
            </div>
          ) : (
            <p className={reader.empty}>This Chapter was left blank.</p>
          )}
        </section>
      ))}

      {file.entries.length > 0 && (
        <section className={styles.sheet}>
          <header className={reader.chapterHead}>
            <h2 className={reader.chapterTitle}>Story Bible</h2>
          </header>
          {entryGroups(file.entries, typeOrder).map((group) => (
            <section key={group.type} className={reader.typeSection}>
              <h3>{ENTRY_GROUP_LABEL[group.type]}</h3>
              {group.entries.map((entry, j) => (
                <article key={j} className={`${reader.entry} ${styles.entry}`}>
                  <h4 className={reader.entryName}>{entry.name}</h4>
                  {entry.description && <p className={reader.entryDescription}>{entry.description}</p>}
                  {entry.aliases.length > 0 && <p className="muted">Aliases: {entry.aliases.join(", ")}</p>}
                  <div className={`${reader.text} ${scriptStyles.scripts}`}>
                    <ProseView content={entry.body} />
                  </div>
                </article>
              ))}
            </section>
          ))}
        </section>
      )}

      {file.credits && file.credits.length > 0 && (
        <section className={styles.sheet}>
          <header className={reader.chapterHead}>
            <h2 className={reader.chapterTitle}>{file.status === "finished" ? "Credits" : "Credits so far"}</h2>
          </header>
          <ol className={reader.credits}>
            {file.credits.map((credit, j) => (
              <li key={j} className={reader.creditName}>
                <span>
                  {credit.name}
                  {credit.role !== "Writer" && <span className="muted"> · {credit.role}</span>}
                </span>
                <span className={reader.share}>{percent.format(credit.share)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
