import { createClient } from "@/lib/supabase/server";
import { NO_DETAILS, storyCardDetails } from "@/lib/story-cards";
import { relativeTime } from "@/lib/relative-time";
import { LiveCounts } from "@/components/LiveCounts";
import { finishedFoot, StoryCard, StorySection } from "@/components/StoryCard";
import styles from "./stories.module.css";

/** Public Stories for signed-out visitors: the target of "Watch live stories". */
export async function PublicStories() {
  const supabase = await createClient();
  const { data: listed } = await supabase.rpc("public_stories");
  const details = await storyCardDetails(supabase, (listed ?? []).map((s) => s.id));
  const stories = (listed ?? []).map((story) => ({ ...story, ...(details.get(story.id) ?? NO_DETAILS) }));
  const writing = stories.filter((s) => s.status !== "finished");
  const finished = stories.filter((s) => s.status === "finished");

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Live stories</h1>
        <p className="muted">
          Public stories, the ones being written right now first. Open one to watch the words appear.
        </p>
      </div>

      {writing.length > 0 && (
        <StorySection title="Being written" count={writing.length}>
          {writing.map((story) => (
            <StoryCard
              key={story.id}
              href={`/stories/${story.id}`}
              title={story.title}
              blurb={story.blurb}
              finished={false}
              ribbon={story.ribbon}
            >
              {story.writers > 0 ? (
                <LiveCounts writers={story.writers} viewers={story.viewers} />
              ) : story.edited_at ? (
                `Edited ${relativeTime(Date.parse(story.edited_at))}`
              ) : (
                "No words yet"
              )}
            </StoryCard>
          ))}
        </StorySection>
      )}

      {finished.length > 0 && (
        <StorySection title="Finished" count={finished.length}>
          {finished.map((story) => (
            <StoryCard
              key={story.id}
              href={`/stories/${story.id}/read`}
              title={story.title}
              blurb={story.blurb}
              finished
              ribbon={story.ribbon}
            >
              {finishedFoot(story.chapterCount, story.words)}
            </StoryCard>
          ))}
        </StorySection>
      )}

      {!stories.length && <p className="muted">No public stories yet.</p>}
    </div>
  );
}
