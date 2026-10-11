import { canChangeRole, canRemove, canSwapViewer, type MemberRole } from "@/lib/story-roles";
import { removeMember, setMemberRole, transferHost } from "@/lib/actions/stories";
import { ActionForm } from "@/components/ActionForm";
import { Dropdown } from "@/components/Dropdown";
import menu from "../menu.module.css";
import styles from "./settings.module.css";

/**
 * A Writers or Viewers row's "···" menu: change role, swap between Writer and Viewer, hand off Host, remove.
 * A spacer instead when there's nothing to do.
 */
export function MemberMenu({
  storyId,
  myRole,
  isPrivate,
  member,
}: {
  storyId: string;
  myRole: MemberRole;
  isPrivate: boolean;
  member: { id: string; username: string; role: MemberRole };
}) {
  const changeRole = canChangeRole(myRole, member.role);
  const swap = canSwapViewer(myRole, member.role, isPrivate);
  const remove = canRemove(myRole, member.role);
  if (!changeRole && !swap && !remove) return <span className={styles.menuSpacer} aria-hidden />;

  return (
    <Dropdown
      label={`${member.username} options`}
      trigger={<span aria-hidden>&middot;&middot;&middot;</span>}
      triggerClassName={menu.more}
      fixed
      panelClassName={menu.menu}
    >
      {changeRole && (
        <ActionForm
          action={setMemberRole.bind(null, storyId, member.id, member.role === "writer" ? "cohost" : "writer")}
        >
          <button className={menu.menuItem}>{member.role === "writer" ? "Make Co-host" : "Make Writer"}</button>
        </ActionForm>
      )}
      {swap && (
        <ActionForm
          action={setMemberRole.bind(null, storyId, member.id, member.role === "viewer" ? "writer" : "viewer")}
        >
          <button className={menu.menuItem}>{member.role === "viewer" ? "Make Writer" : "Make Viewer"}</button>
        </ActionForm>
      )}
      {changeRole && (
        <ActionForm
          action={transferHost.bind(null, storyId, member.id)}
          confirm={`Hand off Host to ${member.username}? You'll become a Co-host.`}
        >
          <button className={menu.menuItem}>Hand off Host&hellip;</button>
        </ActionForm>
      )}
      {remove && (
        <>
          {(changeRole || swap) && <hr className={menu.divider} />}
          <ActionForm
            action={removeMember.bind(null, storyId, member.id)}
            confirm={`Remove ${member.username} from this story?`}
          >
            <button className={`${menu.menuItem} ${menu.danger}`}>Remove from Story&hellip;</button>
          </ActionForm>
        </>
      )}
    </Dropdown>
  );
}
