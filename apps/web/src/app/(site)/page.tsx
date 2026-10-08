import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getLiveStories } from "@/lib/front-page";
import { LiveCounts } from "@/components/LiveCounts";
import { WritingDemo } from "@/components/WritingDemo";
import styles from "./home.module.css";

export default async function Home() {
  if (await getViewer()) redirect("/stories");
  const live = await getLiveStories();

  return (
    <div className={styles.page}>
      <div className={styles.copy}>
        <h1>Write one story together, live.</h1>
        <p className="muted">
          Invite your friends, open a Chapter, and type into the same page at the same time. Public stories can be
          watched as they&rsquo;re written.
        </p>
        <div className={styles.ctas}>
          <Link href={`/login?next=${encodeURIComponent("/stories?new=1#new")}`} className="button button-primary">
            Start a story
          </Link>
          <Link href="/stories" className="button button-ghost">
            Watch one being written &rarr;
          </Link>
        </div>
      </div>

      <WritingDemo />

      {live.length > 0 && (
        <section className={styles.now}>
          <h2 className="smallcaps">Being written now</h2>
          <ul>
            {live.map((story) => (
              <li key={story.id}>
                <Link href={`/stories/${story.id}`} className={styles.title}>
                  {story.title}
                </Link>
                <LiveCounts writers={story.writers} viewers={story.viewers} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
