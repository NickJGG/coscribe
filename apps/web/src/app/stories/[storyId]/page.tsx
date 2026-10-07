import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChapters, getEntries, getStory } from "@/lib/story";
import { getViewer } from "@/lib/viewer";
import { ROLE_LABEL } from "@/lib/story-roles";
import { ENTRY_TYPE_LABEL, ENTRY_TYPES, NAME_MAX } from "@/lib/entries";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { addEntry } from "@/lib/actions/entries";
import { ActionForm } from "@/components/ActionForm";
import { PersonLink } from "@/components/PersonLink";
import { BibleList } from "./BibleList";
import { ChapterList } from "./ChapterList";
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
  const [chapters, entries] = await Promise.all([getChapters(story.id), getEntries(story.id)]);
  const finished = story.status === "finished";
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
    <div className={styles.page}>
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
          {finished && <span className="pill">Finished</span>}
          {myRole && (
            <span className="pill">
              You&rsquo;re {myRole === "host" ? "the" : "a"} {ROLE_LABEL[myRole]}
            </span>
          )}
        </div>
        <h1 className={styles.title}>{story.title}</h1>
        {(finished || myRole) && (
          <div className="row-actions">
            {finished && (
              <>
                <Link href={`/stories/${story.id}/read`} className="button button-primary">
                  Read the story
                </Link>
                <Link href={`/stories/${story.id}/read/credits`} className="button">
                  Credits
                </Link>
              </>
            )}
            {myRole && (
              <Link href={`/stories/${story.id}/settings`} className={finished ? "button" : "button button-small"}>
                Settings
              </Link>
            )}
          </div>
        )}
      </header>

      <div className={styles.columns}>
        <section className="section">
          <h2>Chapters</h2>
          <ChapterList storyId={story.id} chapters={chapters} myRole={myRole} finished={finished} />
        </section>

        <section className="section">
          <h2>Story Bible</h2>
          <BibleList storyId={story.id} entries={entries} />
          {myRole && !finished && (
            <ActionForm action={addEntry.bind(null, story.id)} className={styles.inlineForm}>
              <select name="type" className="input" aria-label="New Entry type" defaultValue="character">
                {ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ENTRY_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <input
                name="name"
                className="input"
                placeholder="Name"
                maxLength={NAME_MAX}
                required
                aria-label="New Entry name"
              />
              <button className="button">Add Entry</button>
            </ActionForm>
          )}
        </section>
      </div>

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
