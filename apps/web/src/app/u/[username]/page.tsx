import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import styles from "./profile.module.css";

const getProfile = cache(async (username: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, author_color, created_at")
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

  const since = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="page">
      <header className={styles.header} style={{ "--author": profile.author_color } as React.CSSProperties}>
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
        <p className="muted">No public stories yet.</p>
      </section>
    </div>
  );
}
