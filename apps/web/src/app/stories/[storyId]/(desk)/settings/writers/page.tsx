import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { canChangeRole, canRemove, ROLE_LABEL, type MemberRole } from "@/lib/story-roles";
import { removeMember, setMemberRole, transferHost } from "@/lib/actions/stories";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import { PersonLink } from "@/components/PersonLink";
import { Card, Sub } from "../Card";
import menu from "../../menu.module.css";
import styles from "../settings.module.css";

export default async function StorySettingsWritersPage(props: PageProps<"/stories/[storyId]/settings/writers">) {
  const { storyId } = await props.params;
  const me = await requireProfile(`/stories/${storyId}/settings/writers`);
  const data = await getStory(storyId);
  if (!data?.myRole) notFound();
  const { story, members, myRole } = data;

  return (
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
                <WriterMenu storyId={story.id} myRole={myRole} writer={{ ...m.profile, role: m.role }} />
              </div>
            </li>
          ))}
        </ul>
      </Sub>
    </Card>
  );
}

/** A Writer row's "···" menu: change role, hand off Host, remove. A spacer instead when there's nothing to do. */
function WriterMenu({
  storyId,
  myRole,
  writer,
}: {
  storyId: string;
  myRole: MemberRole;
  writer: { id: string; username: string; role: MemberRole };
}) {
  const changeRole = canChangeRole(myRole, writer.role);
  const remove = canRemove(myRole, writer.role);
  if (!changeRole && !remove) return <span className={styles.menuSpacer} aria-hidden />;

  return (
    <Dropdown
      label={`${writer.username} options`}
      trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
      triggerClassName={menu.more}
      fixed
      panelClassName={menu.menu}
    >
      {changeRole && (
        <>
          <ActionForm
            action={setMemberRole.bind(null, storyId, writer.id, writer.role === "writer" ? "cohost" : "writer")}
          >
            <button className={menu.menuItem}>{writer.role === "writer" ? "Make Co-host" : "Make Writer"}</button>
          </ActionForm>
          <ActionForm
            action={transferHost.bind(null, storyId, writer.id)}
            confirm={`Hand off Host to ${writer.username}? You'll become a Co-host.`}
          >
            <button className={menu.menuItem}>Hand off Host&hellip;</button>
          </ActionForm>
        </>
      )}
      {remove && (
        <>
          {changeRole && <hr className={menu.divider} />}
          <ActionForm
            action={removeMember.bind(null, storyId, writer.id)}
            confirm={`Remove ${writer.username} from this story?`}
          >
            <button className={`${menu.menuItem} ${menu.danger}`}>Remove from Story&hellip;</button>
          </ActionForm>
        </>
      )}
    </Dropdown>
  );
}
