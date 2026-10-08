import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { colorName } from "@/lib/profile-rules";
import { canChangeRole, canLeave, canManageInvites, canRemove, ROLE_LABEL } from "@/lib/story-roles";
import {
  deleteStory,
  leaveStory,
  removeMember,
  setMemberRole,
  setStoryColor,
  setStoryFinished,
  transferHost,
  updateStory,
} from "@/lib/actions/stories";
import { createInviteLink, deleteInvite, inviteFriend } from "@/lib/actions/invites";
import { ActionForm } from "@/components/ActionForm";
import { ColorSwatches } from "@/components/ColorSwatches";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { PersonLink } from "@/components/PersonLink";
import { StoryFields } from "@/components/StoryFields";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: "Story settings" };

export default async function StorySettingsPage(props: PageProps<"/stories/[storyId]/settings">) {
  const { storyId } = await props.params;
  const me = await requireProfile(`/stories/${storyId}/settings`);
  const data = await getStory(storyId);
  if (!data?.myRole) notFound();
  const { story, members, myRole } = data;

  return (
    <div className="page">
      <h1>Settings</h1>

      {myRole === "host" && (
        <section className="section">
          <h2>Story</h2>
          <ActionForm action={updateStory.bind(null, story.id)} className={styles.form}>
            <StoryFields title={story.title} visibility={story.visibility} />
            <div>
              <button className="button button-primary">Save</button>
            </div>
          </ActionForm>
        </section>
      )}

      <YourColor
        storyId={story.id}
        members={members.map((m) => m.profile)}
        userId={me.userId}
        profileColor={me.profile.author_color}
      />

      {myRole === "host" && (
        <section className="section">
          <h2>Finished</h2>
          {story.status === "finished" ? (
            <>
              <p className="muted">
                This story is Finished: every Chapter and Entry is locked, and readers get the{" "}
                <Link href={`/stories/${story.id}/read`}>Reader View</Link>. Reopen it to keep writing.
              </p>
              <ActionForm action={setStoryFinished.bind(null, story.id, false)}>
                <button className="button">Reopen story</button>
              </ActionForm>
            </>
          ) : (
            <>
              <p className="muted">
                Done writing? Finishing locks every Chapter and Entry for everyone, live, and opens the Reader View
                with Credits. You can reopen it any time.
              </p>
              <ActionForm
                action={setStoryFinished.bind(null, story.id, true)}
                confirm={`Mark "${story.title}" Finished? Editing locks for everyone until you reopen it.`}
              >
                <button className="button button-primary">Mark Finished</button>
              </ActionForm>
            </>
          )}
        </section>
      )}

      <section className="section">
        <h2>Writers</h2>
        <ul className="rows">
          {members.map((m) => (
            <li key={m.profile.id} className="row">
              <span>
                <PersonLink person={m.profile} />
                {m.profile.id === me.userId && <span className="muted"> (you)</span>}
              </span>
              <div className="row-actions">
                <span className="pill">{ROLE_LABEL[m.role]}</span>
                {canChangeRole(myRole, m.role) && (
                  <>
                    <ActionForm
                      action={setMemberRole.bind(null, story.id, m.profile.id, m.role === "writer" ? "cohost" : "writer")}
                    >
                      <button className="button button-small">
                        {m.role === "writer" ? "Make Co-host" : "Make Writer"}
                      </button>
                    </ActionForm>
                    <ActionForm
                      action={transferHost.bind(null, story.id, m.profile.id)}
                      confirm={`Hand off Host to ${m.profile.username}? You'll become a Co-host.`}
                    >
                      <button className="button button-small">Hand off Host</button>
                    </ActionForm>
                  </>
                )}
                {canRemove(myRole, m.role) && (
                  <ActionForm
                    action={removeMember.bind(null, story.id, m.profile.id)}
                    confirm={`Remove ${m.profile.username} from this story?`}
                  >
                    <button className="button button-small button-danger">Remove</button>
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canManageInvites(myRole) && (
        <Invites storyId={story.id} userId={me.userId} memberIds={members.map((m) => m.profile.id)} />
      )}

      <section className="section">
        <h2>Leave or delete</h2>
        {canLeave(myRole) && (
          <ActionForm action={leaveStory.bind(null, story.id)} confirm="Leave this story? You'll need a new Invite to come back.">
            <button className="button button-danger">Leave story</button>
          </ActionForm>
        )}
        {myRole === "host" && (
          <>
            <p className="muted">Hand off Host to someone else to leave. Deleting removes the story for everyone.</p>
            <ActionForm
              action={deleteStory.bind(null, story.id)}
              confirm={`Delete "${story.title}" for everyone? This can't be undone.`}
            >
              <button className="button button-danger">Delete story</button>
            </ActionForm>
          </>
        )}
      </section>
    </div>
  );
}

function YourColor({
  storyId,
  members,
  userId,
  profileColor,
}: {
  storyId: string;
  members: { id: string; username: string; author_color: string }[];
  userId: string;
  profileColor: string;
}) {
  const mine = members.find((m) => m.id === userId)?.author_color ?? profileColor;
  const taken = new Map(members.filter((m) => m.id !== userId).map((m) => [m.author_color, m.username]));
  const owner = taken.get(profileColor);

  return (
    <section className="section">
      <h2>Your color in this Story</h2>
      {mine !== profileColor && (
        <p className="muted">
          {owner
            ? `You're ${colorName(mine)} in this Story because ${owner} is ${colorName(profileColor)}.`
            : `You picked ${colorName(mine)} here. Your profile color is ${colorName(profileColor)}.`}
        </p>
      )}
      <ActionForm action={setStoryColor.bind(null, storyId)} className={styles.form}>
        <ColorSwatches key={mine} name="author_color" selected={mine} taken={taken} />
        <div>
          <button className="button">Save color</button>
        </div>
      </ActionForm>
    </section>
  );
}

async function Invites({ storyId, userId, memberIds }: { storyId: string; userId: string; memberIds: string[] }) {
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
  const unavailable = new Set([...memberIds, ...friendInvites.map((i) => i.invitee!.id)]);
  const invitable = (friendships ?? [])
    .map((f) => (f.requester_id === userId ? f.addressee : f.requester))
    .filter((friend) => !unavailable.has(friend.id))
    .sort((a, b) => a.username.localeCompare(b.username));

  return (
    <section className="section" id="invites">
      <h2>Invites</h2>
      <p className="muted">Each Invite makes one person a Writer.</p>

      <h3 className={styles.subheading}>Invite a Friend</h3>
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

      {friendInvites.length > 0 && (
        <>
          <h3 className={styles.subheading}>Waiting to accept</h3>
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
        </>
      )}

      <h3 className={styles.subheading}>Invite Links</h3>
      <p className="muted">
        Each link works once, for one person, and makes them your Friend too. Send it privately.
      </p>
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
      <ActionForm action={createInviteLink.bind(null, storyId)}>
        <button className="button">New Invite Link</button>
      </ActionForm>
    </section>
  );
}
