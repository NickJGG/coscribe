import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getStory } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { SearchResults } from "./SearchResults";

export const metadata: Metadata = { title: "Search" };

/** Story search's results, found in the browser over the Story's text. */
export default async function SearchPage(props: PageProps<"/stories/[storyId]/search">) {
  const { storyId } = await props.params;
  if (!(await getStory(storyId))) {
    if (!(await getViewer())) redirect(`/login?next=${encodeURIComponent(`/stories/${storyId}/search`)}`);
    notFound();
  }
  return <SearchResults storyId={storyId} />;
}
