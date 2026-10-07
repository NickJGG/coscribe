import { getStory } from "@/lib/story";
import { StoryChat } from "@/components/StoryChat";

/** Keeps Story Chat mounted, and subscribed, while moving between a story's pages. Viewers never get it. */
export default async function StoryLayout(props: LayoutProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);

  return (
    <>
      {props.children}
      {data?.myRole && data.viewer && (
        <StoryChat storyId={data.story.id} me={data.viewer.userId} members={data.members.map((m) => m.profile)} />
      )}
    </>
  );
}
