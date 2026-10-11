import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { canManageInvites } from "@/lib/story-roles";
import { createInviteLink, deleteInvite, inviteFriend } from "@/lib/actions/invites";
import { ActionForm } from "@/components/ActionForm";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PersonLink } from "@/components/PersonLink";
import { Card, Sub } from "../Card";
import styles from "../settings.module.css";

export default async function StorySettingsInvitesPage(props: PageProps<"/stories/[storyId]/settings/invites">) {
  const { storyId } = await props.params;
  const me = await requireProfile(`/stories/${storyId}/settings/invites`);
  const data = await getStory(storyId);
  if (!data || !canManageInvites(data.myRole)) notFound();

  const supabase = await createClient();
  const [{ data: invites }, { data: friendships }] = await Promise.all([
    supabase
      .from("invites")
      .select("id, token, invitee:profiles!invites_invitee_id_fkey (id, username, author_color)")
      .eq("story_id", storyId)
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

  const friendInvites = (invites ?? []).filter((i) => i.invitee);
  const linkInvites = (invites ?? []).filter((i) => i.token);
  const unavailable = new Set([...data.members.map((m) => m.profile.id), ...friendInvites.map((i) => i.invitee!.id)]);
  const invitable = (friendships ?? [])
    .map((f) => (f.requester_id === me.userId ? f.addressee : f.requester))
    .filter((friend) => !unavailable.has(friend.id))
    .sort((a, b) => a.username.localeCompare(b.username));
  const finished = data.story.status === "finished";

  return (
    <Card title="Invites" description="Each Invite makes one person a Writer.">
      {finished ? (
        <Sub>
          <p className="muted">This story is Finished. Reopen it to invite Writers.</p>
        </Sub>
      ) : (
        <Sub>
          <h3>Invite a Friend</h3>
          {invitable.length ? (
            <ul className="rows">
              {invitable.map((friend) => (
                <li key={friend.id} className="row">
                  <PersonLink person={friend} />
                  <ActionForm action={inviteFriend.bind(null, storyId, friend.id)}>
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

      {(!finished || linkInvites.length > 0) && (
        <Sub>
          <div className={styles.inlineRow}>
            <div>
              <h3>Invite Links</h3>
              <p className="muted">
                {finished
                  ? "They can join once the story is Reopened."
                  : "Each link works once, for one person. Send it privately."}
              </p>
            </div>
            {!finished && (
              <ActionForm action={createInviteLink.bind(null, storyId)}>
                <button className="button">New Invite Link</button>
              </ActionForm>
            )}
          </div>
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
