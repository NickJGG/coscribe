import { notFound, redirect } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";

export default async function StorySettingsPage(props: PageProps<"/stories/[storyId]/settings">) {
  const { storyId } = await props.params;
  await requireProfile(`/stories/${storyId}/settings`);
  const data = await getStory(storyId);
  if (!data?.myRole) notFound();
  redirect(`/stories/${storyId}/settings/${data.myRole === "host" ? "story" : "writers"}`);
}
