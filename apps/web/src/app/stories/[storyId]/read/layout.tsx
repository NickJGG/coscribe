import Link from "next/link";
import { getReader } from "@/lib/reader";
import { AccountMenus } from "@/components/SiteHeader";
import { SignInLink } from "@/components/SignInLink";
import { NarrationPlayer } from "@/components/narration/NarrationPlayer";
import { ReaderFrame, ReaderLinks, TextSize } from "./ReaderHeader";
import styles from "./reader.module.css";

/** The Reader's shell: the Story title back to its overview, the book's sections, text size, and Narration's player. */
export default async function ReaderLayout(props: LayoutProps<"/stories/[storyId]/read">) {
  const { storyId } = await props.params;
  const data = await getReader(storyId);
  // The page decides between sign in, not found, and back to the Story.
  if (!data?.finished) return props.children;

  const { story, entries, viewer } = data;

  return (
    <ReaderFrame>
      <header className={styles.header}>
        <Link href={`/stories/${story.id}`} className={styles.headerStory}>
          {story.title}
        </Link>
        <ReaderLinks storyId={story.id} hasBible={entries.length > 0} />
        <div className={styles.end}>
          <TextSize />
          {viewer?.profile ? (
            <AccountMenus profile={viewer.profile} />
          ) : viewer ? (
            <Link href="/onboarding" className="button button-primary button-small">
              Finish sign-up
            </Link>
          ) : (
            <SignInLink className="button button-ghost button-small" />
          )}
        </div>
      </header>
      <main>{props.children}</main>
      <NarrationPlayer sticky />
    </ReaderFrame>
  );
}
