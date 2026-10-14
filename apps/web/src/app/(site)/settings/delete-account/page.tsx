import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { getStoryTrash } from "@/lib/story";
import { hostedStories } from "@/lib/account";
import { ROLE_LABEL } from "@/lib/story-roles";
import { handOverStory } from "@/lib/actions/account";
import { ActionForm } from "@/components/ActionForm";
import { DeleteAccountForm } from "./DeleteAccountForm";
import styles from "./delete-account.module.css";

export const metadata: Metadata = { title: "Delete your account" };

export default async function DeleteAccountPage() {
  const me = await requireProfile("/settings/delete-account");
  const supabase = await createClient();

  const [trash, { data: memberships }] = await Promise.all([
    getStoryTrash(),
    supabase
      .from("story_members")
      .select(`
        role,
        story:stories!inner (
          id, title,
          members:story_members (role, joined_at, profile:profiles (id, username))
        )
      `)
      .eq("user_id", me.userId),
  ]);
  const { handOver, solo } = hostedStories(memberships ?? [], me.userId);

  return (
    <div className="page">
      <Link href="/settings" className={styles.back}>
        &larr; Settings
      </Link>
      <div className={styles.head}>
        <h1>Delete your account</h1>
        <p className="muted">This can&rsquo;t be undone.</p>
      </div>

      <section className="section">
        <h2>What happens to your writing</h2>
        <ul className="rows">
          <li className="row">
            <div className={styles.meta}>
              <span>Stays in other Writers&rsquo; Stories, credited to &ldquo;A deleted account&rdquo;</span>
              <small>Your text in Chapters and the Story Bible, your Notes and your Story Chat messages.</small>
            </div>
          </li>
          <li className="row">
            <div className={styles.meta}>
              <span>Deleted</span>
              <small>Your profile, username, Bio, Featured Passages, Friends and Invites.</small>
            </div>
          </li>
        </ul>
      </section>

      {handOver.length > 0 && (
        <section className="section">
          <h2>Stories you Host</h2>
          <p className="muted">Hand each one to another Writer before you go.</p>
          <ul className="rows">
            {handOver.map((story) => (
              <li key={story.id} className="row">
                <div className={styles.meta}>
                  <span className={styles.title}>{story.title}</span>
                  <small>
                    {story.writers.length === 1 ? "1 other Writer" : `${story.writers.length} other Writers`}
                  </small>
                </div>
                <ActionForm action={handOverStory.bind(null, story.id)}>
                  <div className="row-actions">
                    <select
                      name="user"
                      className={`input ${styles.picker}`}
                      aria-label={`New Host of ${story.title}`}
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Choose a Writer&hellip;
                      </option>
                      {story.writers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.username} ({ROLE_LABEL[w.role]})
                        </option>
                      ))}
                    </select>
                    <button className="button button-small">Make Host</button>
                  </div>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      {solo.length + trash.length > 0 && (
        <section className="section">
          <h2>Deleted with your account</h2>
          <p className="muted">
            {[solo.length > 0 && "You’re the only Writer in these.", trash.length > 0 && "Stories in your Trash go too."]
              .filter(Boolean)
              .join(" ")}
          </p>
          <ul className="rows">
            {solo.map((story) => (
              <li key={story.id} className="row">
                <span className={styles.title}>{story.title}</span>
                <span className="pill">Only you</span>
              </li>
            ))}
            {trash.map((story) => (
              <li key={story.id} className="row">
                <span className={styles.title}>{story.title}</span>
                <span className="pill">In your Trash</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DeleteAccountForm username={me.profile.username} handOvers={handOver.length} />
    </div>
  );
}
