import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { getLiveStories, getRecentlyFinished } from "@/lib/front-page";
import { LiveCounts } from "@/components/LiveCounts";
import { finishedFoot, StoryCard, StoryGrid } from "@/components/StoryCard";
import { AuthorsDemo, BibleDemo, NotesDemo, WritingDemo } from "@/components/WritingDemo";
import styles from "./home.module.css";

const START_HREF = `/login?next=${encodeURIComponent("/stories?new=1#new")}`;

export default async function Home() {
  if (await getViewer()) redirect("/stories");
  const live = await getLiveStories();
  const finished = live.length ? [] : await getRecentlyFinished();

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.copy}>
          <h1>Write one story together, live.</h1>
          <p className="muted">
            Invite your friends, open a Chapter, and type into the same page at the same time. Public stories can be
            watched as they&rsquo;re written.
          </p>
          <div className={styles.ctas}>
            <Link href={START_HREF} className="button button-primary">
              Start a story
            </Link>
            <Link href="/stories" className="button button-ghost">
              Watch one being written &rarr;
            </Link>
          </div>
        </div>

        <WritingDemo />
      </div>

      <section className={styles.section}>
        <SectionHead title="What writing together looks like">
          It all happens on the page, where every Writer can see it.
        </SectionHead>
        <div className={styles.demoRow}>
          <DemoCard title="Notes in the margin" demo={<NotesDemo />}>
            Pin a Note to a passage, talk it through, and Resolve it when it&rsquo;s fixed.
          </DemoCard>
          <DemoCard title="See who wrote what" demo={<AuthorsDemo />}>
            Every Writer&rsquo;s words carry their Author Color. Turn on Show authors to see them.
          </DemoCard>
          <DemoCard title="A Story Bible that keeps up" demo={<BibleDemo />}>
            Names from the Story Bible are underlined as you write. Hover one to see its Entry.
          </DemoCard>
        </div>
      </section>

      <section className={styles.section}>
        <SectionHead title="How it works">From a blank page to a finished book.</SectionHead>
        <ol className={styles.steps}>
          <li>
            <h3>Start a Story</h3>
            <p>Give it a title and a Blurb, then invite your Friends as Writers.</p>
          </li>
          <li>
            <h3>Write it together</h3>
            <p>Open a Chapter and everyone types at once. Make it Public and anyone can watch.</p>
          </li>
          <li>
            <h3>Finish it</h3>
            <p>When it&rsquo;s done, mark it Finished. It becomes a book to read, with Credits for every Writer.</p>
          </li>
        </ol>
      </section>

      {live.length > 0 ? (
        <section className={styles.section}>
          <SectionHead title="Being written now" more>
            Public Stories you can watch right now, as they&rsquo;re written.
          </SectionHead>
          <StoryGrid>
            {live.map((story) => (
              <StoryCard
                key={story.id}
                href={`/stories/${story.id}`}
                title={story.title}
                blurb={story.blurb}
                finished={false}
                ribbon={story.ribbon}
              >
                <LiveCounts writers={story.writers} viewers={story.viewers} />
              </StoryCard>
            ))}
          </StoryGrid>
        </section>
      ) : (
        finished.length > 0 && (
          <section className={styles.section}>
            <SectionHead title="Recently Finished" more>
              Read them from the first line to the Credits.
            </SectionHead>
            <StoryGrid>
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
            </StoryGrid>
          </section>
        )
      )}

      <section className={styles.closing}>
        <h2>Somebody has to write the first line.</h2>
        <p className={styles.lede}>Invite your Friends and open the first Chapter.</p>
        <Link href={START_HREF} className="button button-primary">
          Start a story
        </Link>
      </section>
    </div>
  );
}

function SectionHead({ title, more, children }: { title: string; more?: boolean; children: React.ReactNode }) {
  return (
    <div className={styles.head}>
      <div className={styles.headRow}>
        <h2>{title}</h2>
        {more && (
          <Link href="/stories" className={styles.more}>
            All public stories &rarr;
          </Link>
        )}
      </div>
      <p className={styles.lede}>{children}</p>
    </div>
  );
}

function DemoCard({ title, demo, children }: { title: string; demo: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={styles.demoCard}>
      {demo}
      <h3>{title}</h3>
      <p className={styles.caption}>{children}</p>
    </div>
  );
}
