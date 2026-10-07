import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStory } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { ROLE_LABEL } from "@/lib/story-roles";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { ActionForm } from "@/components/ActionForm";
import { PersonLink } from "@/components/PersonLink";
import styles from "./story.module.css";

export async function generateMetadata(props: PageProps<"/stories/[storyId]">): Promise<Metadata> {
  const data = await getStory((await props.params).storyId);
  return { title: data?.story.title ?? "Story" };
}

export default async function StoryPage(props: PageProps<"/stories/[storyId]">) {
  const { storyId } = await props.params;
  const data = await getStory(storyId);
  if (!data) {
    // Private stories look missing to everyone outside them; a signed-out member just needs to sign in.
    if (!(await getViewer())) redirect(`/login?next=${encodeURIComponent(`/stories/${storyId}`)}`);
    notFound();
  }
  const { story, members, myRole, viewer } = data;

  const supabase = await createClient();
  const { data: invite } =
    viewer && !myRole
      ? await supabase
          .from("invites")
          .select("id")
          .eq("story_id", story.id)
          .eq("invitee_id", viewer.userId)
          .is("used_at", null)
          .maybeSingle()
      : { data: null };

  return (
    <div className="page">
      {invite && (
        <div className={styles.invite}>
          <p>You&rsquo;ve been invited to write in this story.</p>
          <div className="row-actions">
            <ActionForm action={acceptInvite.bind(null, invite.id)}>
              <button className="button button-primary button-small">Join as Writer</button>
            </ActionForm>
            <ActionForm action={deleteInvite.bind(null, invite.id)}>
              <button className="button button-small">Decline</button>
            </ActionForm>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.meta}>
          <span className="pill">{story.visibility === "public" ? "Public" : "Private"}</span>
          {story.status === "finished" && <span className="pill">Finished</span>}
          {myRole && (
            <span className="pill">
              You&rsquo;re {myRole === "host" ? "the" : "a"} {ROLE_LABEL[myRole]}
            </span>
          )}
        </div>
        <h1 className={styles.title}>{story.title}</h1>
        {myRole && (
          <div>
            <Link href={`/stories/${story.id}/settings`} className="button button-small">
              Settings
            </Link>
          </div>
        )}
      </header>

      <section className="section">
        <h2>Chapters</h2>
        <p className="muted">No chapters yet. Live chapter editing arrives soon.</p>
      </section>

      <section className="section">
        <h2>Writers</h2>
        <ul className={styles.writers}>
          {members.map((m) => (
            <li key={m.profile.id}>
              <PersonLink person={m.profile} />
              {m.role !== "writer" && <span className="muted"> · {ROLE_LABEL[m.role]}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
