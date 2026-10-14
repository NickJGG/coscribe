import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { getStory } from "@/lib/story";
import { createInviteLink, deleteInvite, inviteFriend, type InviteRole } from "@/lib/actions/invites";
import { ActionForm } from "@/components/ActionForm";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PersonLink } from "@/components/PersonLink";
import { Card, InlineRow, Sub } from "@/components/SettingsCard";
import styles from "./settings.module.css";

export const INVITE_COPY = {
  writer: {
    title: "Invite Writers",
    description: "Each Invite makes one person a Writer.",
    link: "Each link works once, for one person. Send it privately.",
  },
  viewer: {
    title: "Invite Viewers",
    description: "Each Invite lets one person read along.",
    link: "Each link works once, for one person, and lets them read along. Send it privately.",
  },
} as const;

/**
 * The "Invite Writers" or "Invite Viewers" card: Invite a Friend, Waiting to accept, and Invite Links for one role.
 * New Writer Invites stop while the story is Finished, and new Viewer Invites while it's Public; pending ones stay
 * listed so they can be revoked. Renders nothing for Viewers on a Public story with nothing pending.
 */
export async function InviteCard({
  role,
  data,
  userId,
}: {
  role: InviteRole;
  data: NonNullable<Awaited<ReturnType<typeof getStory>>>;
  userId: string;
}) {
  const { story } = data;
  const supabase = await createClient();
  const [{ data: invites }, { data: friendships }] = await Promise.all([
    supabase
      .from("invites")
      .select("id, token, role, invitee:profiles!invites_invitee_id_fkey (id, username, author_color)")
      .eq("story_id", story.id)
      .is("used_at", null)
      .order("created_at"),
    supabase
      .from("friendships")
      .select(`
        requester_id,
        requester:profiles!friendships_requester_id_fkey (id, username, author_color),
        addressee:profiles!friendships_addressee_id_fkey (id, username, author_color)
      `)
      .eq("status", "accepted"),
  ]);

  const mine = (invites ?? []).filter((i) => i.role === role);
  const friendInvites = mine.filter((i) => i.invitee);
  const linkInvites = mine.filter((i) => i.token);
  const unavailable = new Set([
    ...[...data.members, ...data.viewers].map((m) => m.profile.id),
    ...(invites ?? []).flatMap((i) => (i.invitee ? [i.invitee.id] : [])),
  ]);
  const invitable = (friendships ?? [])
    .map((f) => (f.requester_id === userId ? f.addressee : f.requester))
    .filter((friend) => !unavailable.has(friend.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  const finished = role === "writer" && story.status === "finished";
  const isPublic = role === "viewer" && story.visibility !== "private";
  const closed = finished || isPublic;
  if (isPublic && !mine.length) return null;
  const copy = INVITE_COPY[role];

  return (
    <Card title={copy.title} description={copy.description}>
      {closed ? (
        <Sub>
          <p className="muted">
            {finished
              ? "This story is Finished. Reopen it to invite Writers."
              : "This story is Public, so anyone can read it without an Invite."}
          </p>
        </Sub>
      ) : (
        <Sub>
          <h3>Invite a Friend</h3>
          {invitable.length ? (
            <ul className="rows">
              {invitable.map((friend) => (
                <li key={friend.id} className="row">
                  <PersonLink person={friend} />
                  <ActionForm action={inviteFriend.bind(null, story.id, friend.id, role)}>
                    <button className="button button-small">Invite</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Every Friend is already here or invited. <Link href="/friends">Find more friends</Link>, or use an
              Invite Link.
            </p>
          )}
        </Sub>
      )}

      {friendInvites.length > 0 && (
        <Sub>
          <h3>Waiting to accept</h3>
          {finished && <p className="muted">They can join once the story is Reopened.</p>}
          <ul className="rows">
            {friendInvites.map((invite) => (
              <li key={invite.id} className="row">
                <PersonLink person={invite.invitee!} />
                <ActionForm action={deleteInvite.bind(null, invite.id)}>
                  <button className="button button-small">Revoke</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </Sub>
      )}

      {(!closed || linkInvites.length > 0) && (
        <Sub>
          <InlineRow>
            <div>
              <h3>Invite Links</h3>
              <p className="muted">{finished ? "They can join once the story is Reopened." : copy.link}</p>
            </div>
            {!closed && (
              <ActionForm action={createInviteLink.bind(null, story.id, role)}>
                <button className="button">New Invite Link</button>
              </ActionForm>
            )}
          </InlineRow>
          {linkInvites.length > 0 && (
            <ul className="rows">
              {linkInvites.map((invite) => (
                <li key={invite.id} className="row">
                  <code className={styles.token}>/invite/{invite.token}</code>
                  <div className="row-actions">
                    <CopyLinkButton path={`/invite/${invite.token}`} />
                    <ActionForm action={deleteInvite.bind(null, invite.id)}>
                      <button className="button button-small">Revoke</button>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Sub>
      )}
    </Card>
  );
}
