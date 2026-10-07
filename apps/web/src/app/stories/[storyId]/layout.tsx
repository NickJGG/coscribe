import { getStory } from "@/lib/story";
import { StoryChat } from "@/components/StoryChat";
import { StoryPanelProvider } from "@/components/StoryPanel";

/**
 * Keeps the right panel, and Story Chat's subscription, mounted while moving between a story's pages.
 * Viewers never get Chat. Shells without a PanelSlot (the Reader) never show the panel.
 */
export default async function StoryLayout(props: LayoutProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);

  return (
    <StoryPanelProvider>
      {props.children}
      {data?.myRole && data.viewer && (
        <StoryChat storyId={data.story.id} me={data.viewer.userId} members={data.members.map((m) => m.profile)} />
      )}
    </StoryPanelProvider>
  );
}
