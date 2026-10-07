import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { ROLE_LABEL } from "@/lib/story-roles";
import { createStory } from "@/lib/actions/stories";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { ActionForm } from "@/components/ActionForm";
import { AuthorBadge } from "@/components/AuthorBadge";
import { StoryFields } from "@/components/StoryFields";
import styles from "./stories.module.css";

export const metadata: Metadata = { title: "My stories" };

export default async function StoriesPage() {
  const me = await requireProfile("/stories");
  const supabase = await createClient();

  const [{ data: invites }, { data: memberships }] = await Promise.all([
    supabase
      .from("invites")
      .select(
        "id, story:stories (id, title), inviter:profiles!invites_invited_by_fkey (username, author_color)"
      )
      .eq("invitee_id", me.userId)
      .is("used_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("story_members")
      .select("role, story:stories (id, title, visibility, status)")
      .eq("user_id", me.userId)
      .order("joined_at", { ascending: false }),
  ]);

  return (
    <div className="page">
      <h1>My stories</h1>

      {invites && invites.length > 0 && (
        <section className="section">
          <h2>Invites</h2>
          <ul className="rows">
            {invites.map((invite) => (
              <li key={invite.id} className="row">
                <div>
                  <Link href={`/stories/${invite.story.id}`} className={styles.title}>
                    {invite.story.title}
                  </Link>
                  <p className="muted">
                    from <AuthorBadge username={invite.inviter.username} color={invite.inviter.author_color} />
                  </p>
                </div>
                <div className="row-actions">
                  <ActionForm action={acceptInvite.bind(null, invite.id)}>
                    <button className="button button-primary button-small">Join as Writer</button>
                  </ActionForm>
                  <ActionForm action={deleteInvite.bind(null, invite.id)}>
                    <button className="button button-small">Decline</button>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Writing in</h2>
        {memberships?.length ? (
          <ul className="rows">
            {memberships.map(({ role, story }) => (
              <li key={story.id} className="row">
                <Link href={`/stories/${story.id}`} className={styles.title}>
                  {story.title}
                </Link>
                <div className="row-actions">
                  {story.status === "finished" && <span className="pill">Finished</span>}
                  <span className="pill">{story.visibility === "public" ? "Public" : "Private"}</span>
                  <span className="pill">{ROLE_LABEL[role]}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">You&rsquo;re not in any stories yet. Start one below, or ask a friend for an Invite.</p>
        )}
      </section>

      <section className="section">
        <h2>Start a story</h2>
        <p className="muted">You&rsquo;ll be its Host. You can invite Writers once it&rsquo;s created.</p>
        <ActionForm action={createStory} className={styles.form}>
          <StoryFields />
          <div>
            <button className="button button-primary">Create story</button>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
