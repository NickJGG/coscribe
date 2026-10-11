import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { canManageInvites } from "@/lib/story-roles";
import { PersonLink } from "@/components/PersonLink";
import { Card, Sub } from "../Card";
import { MemberMenu } from "../MemberMenu";
import { InviteCard } from "../InviteCard";

export default async function StorySettingsViewersPage(props: PageProps<"/stories/[storyId]/settings/viewers">) {
  const { storyId } = await props.params;
  const me = await requireProfile(`/stories/${storyId}/settings/viewers`);
  const data = await getStory(storyId);
  if (!data?.myRole) notFound();
  const { story, viewers, myRole } = data;
  const isPrivate = story.visibility === "private";
  if (!isPrivate && !viewers.length) notFound();

  return (
    <>
      <Card
        title="Viewers"
        description={`${viewers.length ? `${viewers.length} ${viewers.length === 1 ? "Viewer" : "Viewers"} reading along.` : "No Viewers yet."} They can't edit or see Story Chat.`}
      >
        {viewers.length > 0 && (
          <Sub>
            <ul className="rows">
              {viewers.map((m) => (
                <li key={m.profile.id} className="row">
                  <span>
                    <PersonLink person={m.profile} />
                    {m.profile.id === me.userId && <span className="muted"> (you)</span>}
                  </span>
                  <div className="row-actions">
                    <MemberMenu
                      storyId={story.id}
                      myRole={myRole}
                      isPrivate={isPrivate}
                      member={{ ...m.profile, role: m.role }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Sub>
        )}
      </Card>
      {canManageInvites(myRole) && <InviteCard role="viewer" data={data} userId={me.userId} />}
    </>
  );
}
