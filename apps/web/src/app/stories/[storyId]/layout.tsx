import { getStory } from "@/lib/story";
import { isWriter } from "@/lib/story-roles";
import { StoryChat } from "@/components/StoryChat";
import { StoryMembersProvider } from "@/components/StoryMembers";
import { StoryPanelProvider } from "@/components/StoryPanel";
import { StoryPresenceProvider } from "@/components/StoryPresence";
import { StoryUpdates } from "@/components/StoryUpdates";
import { OutsideReader } from "./OutsideReader";

/**
 * Keeps the right panel, the members list, and the Story Chat, presence and update subscriptions, mounted while moving
 * between a story's pages. Viewers, invited or not, never get Chat, and the Reader doesn't either.
 */
export default async function StoryLayout(props: LayoutProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);

  const panel = (
    <StoryPanelProvider>
      {props.children}
      {isWriter(data?.myRole) && data?.viewer && (
        <OutsideReader>
          <StoryChat storyId={data.story.id} me={data.viewer.userId} />
        </OutsideReader>
      )}
    </StoryPanelProvider>
  );
  if (!data) return panel;

  const me = data.viewer?.userId ?? null;
  const members = data.members.map(({ profile }) => ({
    id: profile.id,
    name: profile.username,
    color: profile.author_color,
  }));
  return (
    <StoryMembersProvider storyId={data.story.id} me={me} members={members}>
      <StoryPresenceProvider storyId={data.story.id} me={me} members={members}>
        {panel}
        <StoryUpdates storyId={data.story.id} />
      </StoryPresenceProvider>
    </StoryMembersProvider>
  );
}
