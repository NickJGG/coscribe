import { notFound } from "next/navigation";
import { getStory, getTrash } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { canManageChapters } from "@/lib/story-roles";
import { ENTRY_TYPE_LABEL } from "@/lib/entries";
import { relativeTime } from "@/lib/relative-time";
import { daysLeft } from "@/lib/trash";
import { restoreChapter } from "@/lib/actions/chapters";
import { restoreEntry } from "@/lib/actions/entries";
import { emptyTrash } from "@/lib/actions/stories";
import { ActionForm } from "@/components/ActionForm";
import { Card, InlineRow, Sub } from "@/components/SettingsCard";
import styles from "../settings.module.css";

export default async function StorySettingsTrashPage(props: PageProps<"/stories/[storyId]/settings/trash">) {
  const { storyId } = await props.params;
  await requireProfile(`/stories/${storyId}/settings/trash`);
  const data = await getStory(storyId);
  if (!data?.myRole || data.myRole === "viewer") notFound();
  const { story, myRole } = data;
  const trash = await getTrash(story.id);
  const finished = story.status === "finished";
  const restorer = canManageChapters(myRole);

  return (
    <>
      <Card
        title="Trash"
        description={
          trash.length
            ? "Deleted Chapters and Entries wait here for 30 days, then they're gone for good."
            : "Nothing in the Trash. Deleted Chapters and Entries wait here for 30 days."
        }
      >
        {trash.length > 0 && (
          <Sub>
            {restorer && finished && <p className="muted">This story is Finished. Reopen it to restore anything.</p>}
            {!restorer && <p className="muted">The Host or a Co-host can restore these.</p>}
            <ul className="rows">
              {trash.map((item) => (
                <li key={item.id} className="row">
                  <div>
                    <span className={styles.trashTitle}>{item.title}</span>{" "}
                    <span className="pill">{item.kind === "chapter" ? "Chapter" : ENTRY_TYPE_LABEL[item.entry_type]}</span>
                    <p className={`muted ${styles.trashMeta}`}>
                      Deleted by {item.deleted_by_username ?? "a former Writer"} {relativeTime(Date.parse(item.deleted_at))}{" "}
                      &middot; {daysLeft(item.expires_at)}
                    </p>
                  </div>
                  {restorer && (
                    <div className="row-actions">
                      <ActionForm
                        action={
                          item.kind === "chapter"
                            ? restoreChapter.bind(null, story.id, item.id, false)
                            : restoreEntry.bind(null, story.id, item.id, false)
                        }
                      >
                        <button className="button button-small" disabled={finished}>
                          Restore
                        </button>
                      </ActionForm>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Sub>
        )}
      </Card>

      {myRole === "host" && trash.length > 0 && (
        <Card title="Delete for good" danger>
          <Sub>
            <InlineRow>
              <div>
                <h3>Empty Trash</h3>
                <p className="muted">Deletes everything in the Trash now instead of in 30 days. Can&rsquo;t be undone.</p>
              </div>
              <ActionForm
                action={emptyTrash.bind(null, story.id)}
                confirm={{
                  title: `Delete ${trash.length === 1 ? "the 1 item" : `all ${trash.length} items`} in the Trash for good?`,
                  body: "This can't be undone.",
                  action: "Delete",
                  danger: true,
                }}
              >
                <button className="button button-danger">Empty Trash&hellip;</button>
              </ActionForm>
            </InlineRow>
          </Sub>
        </Card>
      )}
    </>
  );
}
