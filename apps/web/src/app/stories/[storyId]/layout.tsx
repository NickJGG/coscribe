import { getStory } from "@/lib/story";
import { StoryChat } from "@/components/StoryChat";
import { StoryPanelProvider } from "@/components/StoryPanel";
import { StoryPresenceProvider } from "@/components/StoryPresence";
import { StoryUpdates } from "@/components/StoryUpdates";
import { OutsideReader } from "./OutsideReader";

/**
 * Keeps the right panel, and the Story Chat, presence and update subscriptions, mounted while moving
 * between a story's pages. Viewers never get Chat, and the Reader doesn't either.
 */
export default async function StoryLayout(props: LayoutProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);

  const panel = (
    <StoryPanelProvider>
      {props.children}
      {data?.myRole && data.viewer && (
        <OutsideReader>
          <StoryChat storyId={data.story.id} me={data.viewer.userId} members={data.members.map((m) => m.profile)} />
        </OutsideReader>
      )}
    </StoryPanelProvider>
  );
  if (!data) return panel;

  return (
    <StoryPresenceProvider
      storyId={data.story.id}
      me={data.viewer?.userId ?? null}
      members={data.members.map(({ profile }) => ({ id: profile.id, name: profile.username, color: profile.author_color }))}
    >
      {panel}
      <StoryUpdates storyId={data.story.id} />
    </StoryPresenceProvider>
  );
}
