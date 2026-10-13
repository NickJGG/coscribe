import type { Metadata } from "next";
import { IMPORTED_AUTHOR } from "@coscribe/editor";
import { getStory } from "@/lib/story";
import { requireReader } from "@/lib/reader";
import { authorColorCss } from "@/lib/profile-rules";
import { ROLE_LABEL } from "@/lib/story-roles";
import { PersonLink } from "@/components/PersonLink";
import { Unavailable } from "../Unavailable";
import styles from "../reader.module.css";

export async function generateMetadata(props: PageProps<"/stories/[storyId]/read/credits">): Promise<Metadata> {
  const data = await getStory((await props.params).storyId);
  return { title: data ? `Credits · ${data.story.title}` : "Credits" };
}

const number = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

/** Each Writer's share of the Chapters, by characters carrying their `author` mark. */
export default async function ReaderCreditsPage(props: PageProps<"/stories/[storyId]/read/credits">) {
  const { storyId } = await props.params;
  const { chapters, credits, members } = await requireReader(storyId, `/stories/${storyId}/read/credits`);
  const roles = new Map(members.map((m) => [m.profile.id, m.role]));
  const total = credits?.reduce((sum, c) => sum + c.chapters, 0) ?? 0;

  return (
    <div className={styles.page}>
      <header className={styles.chapterHead}>
        <h1 className={styles.chapterTitle}>Credits</h1>
        {credits && (
          <p className="muted">
            {number.format(total)} characters across {chapters.length} {chapters.length === 1 ? "Chapter" : "Chapters"}
          </p>
        )}
      </header>

      {!credits ? (
        <Unavailable />
      ) : (
        <ol className={styles.credits}>
          {credits.map((c) => {
            const role = roles.get(c.id);
            const share = total ? c.chapters / total : 0;
            const imported = c.id === IMPORTED_AUTHOR;
            return (
              <li
                key={c.id}
                className={styles.credit}
                style={
                  {
                    "--author": imported ? "var(--faint)" : c.person && authorColorCss(c.person.author_color),
                  } as React.CSSProperties
                }
              >
                <div className={styles.creditName}>
                  <span>
                    {c.person ? (
                      <PersonLink person={c.person} />
                    ) : imported ? (
                      "Imported text"
                    ) : (
                      <span className="muted">A deleted account</span>
                    )}
                    {role && role !== "writer" && <span className="muted"> · {ROLE_LABEL[role]}</span>}
                    {!role && c.person && <span className="muted"> · Former Writer</span>}
                  </span>
                  <span className={styles.share}>{percent.format(share)}</span>
                </div>
                <div className={styles.bar} aria-hidden>
                  <span style={{ width: `${share * 100}%` }} />
                </div>
                <p className={styles.creditDetail}>
                  {number.format(c.chapters)} characters in Chapters
                  {c.bible > 0 && <> · {number.format(c.bible)} in the Story Bible</>}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
