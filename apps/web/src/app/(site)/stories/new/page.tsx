import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/viewer";
import { NewStoryForm } from "./NewStoryForm";
import styles from "./new.module.css";

export const metadata: Metadata = { title: "New Story" };

/** Start a Story, Blank or from a file; `?from=file` opens on the file tab. */
export default async function NewStoryPage(props: PageProps<"/stories/new">) {
  const { from } = await props.searchParams;
  const fromFile = from === "file";
  await requireProfile(fromFile ? "/stories/new?from=file" : "/stories/new");

  return (
    <div className="page">
      <Link href="/stories" className={styles.back}>
        &larr; Your stories
      </Link>
      <div className={styles.head}>
        <h1>Start a story</h1>
        <p className="muted">You&rsquo;ll be its Host. You can invite Writers once it&rsquo;s created.</p>
      </div>
      <NewStoryForm initialFromFile={fromFile} />
    </div>
  );
}
