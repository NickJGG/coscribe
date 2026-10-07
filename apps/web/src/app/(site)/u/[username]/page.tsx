import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/story-roles";
import { authorColorCss } from "@/lib/profile-rules";
import styles from "./profile.module.css";

const getProfile = cache(async (username: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, author_color, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
});

export async function generateMetadata(props: PageProps<"/u/[username]">): Promise<Metadata> {
  const profile = await getProfile((await props.params).username);
  return { title: profile?.username ?? "Not found" };
}

export default async function ProfilePage(props: PageProps<"/u/[username]">) {
  const profile = await getProfile((await props.params).username);
  if (!profile) notFound();
  const stories = await publicStories(profile.id);

  const since = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="page" style={{ "--author": authorColorCss(profile.author_color) } as React.CSSProperties}>
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden>
          {profile.username[0]!.toUpperCase()}
        </span>
        <div>
          <h1>{profile.username}</h1>
          <p className="muted">Writing on Coscribe since {since}</p>
        </div>
      </header>

      <section className={styles.section}>
        <h2>Stories</h2>
        {stories.length ? (
          <ul className="rows">
            {stories.map(({ role, story }) => {
              const finished = story.status === "finished";
              return (
                <li key={story.id} className={`row ${finished ? styles.finished : ""}`}>
                  <Link href={`/stories/${story.id}${finished ? "/read" : ""}`} className={styles.storyTitle}>
                    {story.title}
                  </Link>
                  <div className="row-actions">
                    {finished ? <span className={`pill ${styles.finishedPill}`}>Finished</span> : <span className="pill">Being written</span>}
                    <span className="pill">{ROLE_LABEL[role]}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No public stories yet.</p>
        )}
      </section>
    </div>
  );
}

/** Public stories they host or write in: Finished ones first (newest first), then the rest by newest. */
async function publicStories(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("story_members")
    .select("role, story:stories!inner (id, title, status, created_at, finished_at)")
    .eq("user_id", userId)
    .eq("story.visibility", "public");
  const when = (s: { created_at: string; finished_at: string | null }) => s.finished_at ?? s.created_at;
  return (data ?? []).sort(
    (a, b) =>
      Number(b.story.status === "finished") - Number(a.story.status === "finished") ||
      when(b.story).localeCompare(when(a.story))
  );
}
