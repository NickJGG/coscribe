import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { canManageInvites, ROLE_LABEL } from "@/lib/story-roles";
import { PersonLink } from "@/components/PersonLink";
import { Card, Sub } from "../Card";
import { MemberMenu } from "../MemberMenu";
import { InviteCard } from "../InviteCard";

export default async function StorySettingsWritersPage(props: PageProps<"/stories/[storyId]/settings/writers">) {
  const { storyId } = await props.params;
  const me = await requireProfile(`/stories/${storyId}/settings/writers`);
  const data = await getStory(storyId);
  if (!data?.myRole) notFound();
  const { story, members, myRole } = data;

  return (
    <>
      <Card title="Writers" description={`${members.length} ${members.length === 1 ? "Writer" : "Writers"} in this Story.`}>
        <Sub>
          <ul className="rows">
            {members.map((m) => (
              <li key={m.profile.id} className="row">
                <span>
                  <PersonLink person={m.profile} />
                  {m.profile.id === me.userId && <span className="muted"> (you)</span>}
                </span>
                <div className="row-actions">
                  <span className="pill">{ROLE_LABEL[m.role]}</span>
                  <MemberMenu
                    storyId={story.id}
                    myRole={myRole}
                    isPrivate={story.visibility === "private"}
                    member={{ ...m.profile, role: m.role }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Sub>
      </Card>
      {canManageInvites(myRole) && <InviteCard role="writer" data={data} userId={me.userId} />}
    </>
  );
}
