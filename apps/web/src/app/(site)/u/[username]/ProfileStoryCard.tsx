import type { ProfileStory } from "@/lib/profile";
import { relativeTime } from "@/lib/relative-time";
import { LiveCounts } from "@/components/LiveCounts";
import { finishedFoot, StoryCard } from "@/components/StoryCard";

/** A profile Story: Finished ones open in the Reader View, and the spine lights only `lit` Writers. */
export function ProfileStoryCard({ story, lit }: { story: ProfileStory; lit: ReadonlySet<string> }) {
  const finished = story.status === "finished";
  return (
    <StoryCard
      href={`/stories/${story.id}${finished ? "/read" : ""}`}
      title={story.title}
      blurb={story.blurb}
      finished={finished}
      role={story.role}
      private={story.visibility === "private"}
      ribbon={story.ribbon}
      lit={lit}
    >
      {finished ? (
        finishedFoot(story.chapterCount, story.words)
      ) : story.writers > 0 ? (
        <LiveCounts writers={story.writers} viewers={story.viewers} />
      ) : story.words > 0 && story.editedAt ? (
        `Edited ${relativeTime(Date.parse(story.editedAt))}`
      ) : (
        "No words yet"
      )}
    </StoryCard>
  );
}
