import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formerWriterNames } from "@/lib/story";
import { byJoinOrder, readAuthorChars, storyRibbon } from "@/lib/contribution";
import { relativeTime } from "@/lib/relative-time";
import { ContributionRibbon } from "@/components/ContributionRibbon";
import { LiveCounts } from "@/components/LiveCounts";
import { readingTime } from "@/lib/words";
import styles from "./stories.module.css";

/** Public Stories for signed-out visitors: the target of "Watch live stories". */
export async function PublicStories() {
  const supabase = await createClient();
  const { data: listed } = await supabase.rpc("public_stories");
  const ids = (listed ?? []).map((s) => s.id);

  const { data: details } = ids.length
    ? await supabase
        .from("stories")
        .select(`
          id,
          chapters (word_count, author_chars),
          members:story_members (role, joined_at, author_color, profile:profiles (id, username, author_color))
        `)
        .in("id", ids)
    : { data: [] };
  const byId = new Map((details ?? []).map((d) => [d.id, d]));

  const stories = (listed ?? []).map((story) => {
    const detail = byId.get(story.id);
    const members = (detail?.members ?? [])
      .map((m) => ({
        id: m.profile.id,
        name: m.profile.username,
        color: m.author_color ?? m.profile.author_color,
        role: m.role,
        joinedAt: m.joined_at,
      }))
      .sort(byJoinOrder);
    const chapters = detail?.chapters ?? [];
    const words = chapters.reduce((sum, c) => sum + c.word_count, 0);
    return {
      ...story,
      members,
      chapterCount: chapters.length,
      words,
      readingTime: readingTime(words),
      chars: chapters.map((c) => readAuthorChars(c.author_chars)),
    };
  });

  const formerNames = await formerWriterNames(
    stories.flatMap((s) => {
      const memberIds = new Set(s.members.map((m) => m.id));
      return s.chars.flatMap(Object.keys).filter((id) => !memberIds.has(id));
    })
  );

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Live stories</h1>
        <p className="muted">
          Public stories, the ones being written right now first. Open one to watch the words appear.
        </p>
      </div>

      {stories.length ? (
        <ul className={styles.list}>
          {stories.map((story) => (
            <li key={story.id} className={styles.story}>
              <div className={styles.main}>
                <Link href={`/stories/${story.id}`} className={styles.title}>
                  {story.title}
                </Link>
                {story.blurb && <p className={styles.blurb}>{story.blurb}</p>}
                <span className={styles.sub}>
                  {story.status === "finished" ? (
                    <>
                      <span className="pill">Finished</span>
                      <span>
                        {story.chapterCount} {story.chapterCount === 1 ? "Chapter" : "Chapters"} ·{" "}
                        {story.words.toLocaleString("en-US")} words
                        {story.readingTime && ` · ${story.readingTime} read`}
                      </span>
                    </>
                  ) : story.writers > 0 ? (
                    <LiveCounts writers={story.writers} viewers={story.viewers} />
                  ) : (
                    <span>{story.edited_at ? `Edited ${relativeTime(Date.parse(story.edited_at))}` : "No words yet"}</span>
                  )}
                </span>
              </div>
              <div className={styles.side}>
                <ContributionRibbon segments={storyRibbon(story.members, story.chars, formerNames)} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No public stories yet.</p>
      )}
    </div>
  );
}
