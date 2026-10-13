import Link from "next/link";
import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { deleteStory, setStoryFinished, updateStory } from "@/lib/actions/stories";
import { ActionForm } from "@/components/ActionForm";
import { StoryFields } from "@/components/StoryFields";
import { Card, Sub } from "../Card";
import styles from "../settings.module.css";

export default async function StorySettingsStoryPage(props: PageProps<"/stories/[storyId]/settings/story">) {
  const { storyId } = await props.params;
  await requireProfile(`/stories/${storyId}/settings/story`);
  const data = await getStory(storyId);
  if (data?.myRole !== "host") notFound();
  const { story } = data;
  const finished = story.status === "finished";

  return (
    <>
      <Card title="Story" description="What everyone sees: title, Blurb and who can watch.">
        <Sub>
          <ActionForm action={updateStory.bind(null, story.id)} className={styles.form}>
            <StoryFields title={story.title} blurb={story.blurb} visibility={story.visibility} />
            <div>
              <button className="button button-primary">Save</button>
            </div>
          </ActionForm>
        </Sub>
        <Sub>
          <div className={styles.inlineRow}>
            <div>
              <h3>
                Finished <span className={styles.status}>{finished ? "Finished" : "In progress"}</span>
              </h3>
              {finished ? (
                <p className="muted">
                  This story is Finished: every Chapter and Entry is locked, and readers get the{" "}
                  <Link href={`/stories/${story.id}/read`}>Reader View</Link>. Reopen it to keep writing.
                </p>
              ) : (
                <p className="muted">
                  Done writing? Finishing locks every Chapter and Entry for everyone, live, and opens the Reader
                  View with Credits. You can reopen it any time.
                </p>
              )}
            </div>
            {finished ? (
              <ActionForm action={setStoryFinished.bind(null, story.id, false)}>
                <button className="button">Reopen story</button>
              </ActionForm>
            ) : (
              <ActionForm
                action={setStoryFinished.bind(null, story.id, true)}
                confirm={`Mark "${story.title}" Finished? Editing locks for everyone until you reopen it.`}
              >
                <button className="button button-primary">Mark Finished</button>
              </ActionForm>
            )}
          </div>
        </Sub>
      </Card>

      <Card title="Leave or delete" danger>
        <Sub>
          <div className={styles.inlineRow}>
            <div>
              <h3>Delete story</h3>
              <p className="muted">
                Removes it for everyone. It waits in your Trash for 30 days, where you can restore it. To leave instead, hand off Host first.
              </p>
            </div>
            <ActionForm
              action={deleteStory.bind(null, story.id)}
              confirm={`Delete “${story.title}” for everyone? It goes to your Trash for 30 days, where you can restore it.`}
            >
              <button className="button button-danger">Delete story</button>
            </ActionForm>
          </div>
        </Sub>
      </Card>
    </>
  );
}
