import Link from "next/link";
import Form from "next/form";
import { getViewer } from "@/lib/viewer";
import { getFriendships, getPendingInvites } from "@/lib/connections";
import { signOut } from "@/lib/actions/auth";
import type { Theme } from "@/lib/actions/profile";
import { acceptFriendRequest, removeFriendship } from "@/lib/actions/friends";
import { acceptInvite, deleteInvite } from "@/lib/actions/invites";
import { ActionForm } from "./ActionForm";
import { Avatar } from "./Avatar";
import { Dropdown } from "./Dropdown";
import { NavLink } from "./NavLink";
import { OnlineFriends } from "./OnlineFriends";
import { ThemeSwitch } from "./ThemeSwitch";
import styles from "./SiteHeader.module.css";

const FRIENDS_SHOWN = 8;

export async function SiteHeader() {
  const viewer = await getViewer();
  const profile = viewer?.profile;

  return (
    <header className={styles.header}>
      <Link href={profile ? "/stories" : "/"} className={styles.wordmark}>
        Coscribe
      </Link>
      {profile && (
        <nav className={styles.nav} aria-label="Main">
          <NavLink href="/stories" className={styles.navLink}>
            Stories
          </NavLink>
        </nav>
      )}
      <div className={styles.end}>
        {profile ? (
          <>
            <Link href="/stories?new=1#new" className={`button button-small ${styles.newStory}`}>
              New Story
            </Link>
            <AccountMenus profile={profile} />
          </>
        ) : viewer ? (
          <>
            <Link href="/onboarding" className="button button-primary button-small">
              Finish sign-up
            </Link>
            <form action={signOut}>
              <button className="button button-ghost button-small">Sign out</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="button button-ghost button-small">
              Sign in
            </Link>
            <Link href={`/login?next=${encodeURIComponent("/stories?new=1#new")}`} className="button button-primary button-small">
              Start a story
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

/** Friends, Notifications and You: the right end of every header for a signed-in User. */
export function AccountMenus({ profile }: { profile: { id: string; username: string; author_color: string; theme: Theme } }) {
  return (
    <>
      <FriendsMenu userId={profile.id} />
      <NotificationsMenu userId={profile.id} />
      <YouMenu profile={profile} />
    </>
  );
}

async function FriendsMenu({ userId }: { userId: string }) {
  const { friends, incoming } = await getFriendships(userId);
  const label = incoming.length ? `Friends, ${incoming.length} waiting` : "Friends";

  return (
    <Dropdown
      label={label}
      triggerClassName={styles.iconButton}
      panelClassName={styles.panel}
      trigger={
        <>
          <FriendsIcon />
          <Badge count={incoming.length} />
        </>
      }
    >
      <div className={styles.panelHead}>
        <h2>Friends</h2>
        <Link href="/friends">All friends &rarr;</Link>
      </div>
      <div className={styles.panelBody}>
        {incoming.length > 0 && (
          <section className={styles.panelSection}>
            <h3 className="smallcaps">{incoming.length === 1 ? "Request" : "Requests"}</h3>
            {incoming.map(({ other }) => (
              <div key={other.id} className={styles.personRow}>
                <Avatar name={other.username} color={other.author_color} />
                <Link href={`/u/${other.username}`} className={styles.personName}>
                  {other.username}
                </Link>
                <span className={styles.rowActions}>
                  <ActionForm action={removeFriendship.bind(null, other.id)}>
                    <button className="button button-ghost button-tiny">Decline</button>
                  </ActionForm>
                  <ActionForm action={acceptFriendRequest.bind(null, other.id)}>
                    <button className="button button-primary button-tiny">Accept</button>
                  </ActionForm>
                </span>
              </div>
            ))}
          </section>
        )}
        <OnlineFriends />
        <section className={styles.panelSection}>
          <h3 className="smallcaps">Your friends</h3>
          {friends.length ? (
            friends.slice(0, FRIENDS_SHOWN).map(({ other }) => (
              <Link key={other.id} href={`/u/${other.username}`} className={styles.personRow}>
                <Avatar name={other.username} color={other.author_color} />
                <span className={styles.personName}>{other.username}</span>
              </Link>
            ))
          ) : (
            <p className={`muted ${styles.empty}`}>No friends yet.</p>
          )}
          {friends.length > FRIENDS_SHOWN && (
            <Link href="/friends" className={`muted ${styles.more}`}>
              {friends.length - FRIENDS_SHOWN} more
            </Link>
          )}
        </section>
      </div>
      <Form action="/friends" className={styles.panelFoot}>
        <input
          name="q"
          className="input"
          placeholder="Add a friend by username"
          aria-label="Add a friend by username"
          autoCapitalize="none"
          spellCheck={false}
        />
      </Form>
    </Dropdown>
  );
}

async function NotificationsMenu({ userId }: { userId: string }) {
  const invites = await getPendingInvites(userId);
  const label = invites.length ? `Notifications, ${invites.length} unread` : "Notifications";

  return (
    <Dropdown
      label={label}
      triggerClassName={styles.iconButton}
      panelClassName={styles.panel}
      trigger={
        <>
          <BellIcon />
          <Badge count={invites.length} />
        </>
      }
    >
      <div className={styles.panelHead}>
        <h2>Notifications</h2>
      </div>
      <div className={styles.panelBody}>
        <section className={styles.panelSection}>
          {invites.length ? (
            invites.map((invite) => (
              <div key={invite.id} className={styles.notice}>
                <Avatar name={invite.inviter.username} color={invite.inviter.author_color} />
                <div className={styles.noticeText}>
                  <span>
                    {invite.inviter.username} invited you to write in{" "}
                    <Link href={`/stories/${invite.story.id}`} className={styles.storyName}>
                      {invite.story.title}
                    </Link>
                  </span>
                  <span className={styles.rowActions}>
                    <ActionForm action={deleteInvite.bind(null, invite.id)}>
                      <button className="button button-ghost button-tiny">Decline</button>
                    </ActionForm>
                    <ActionForm action={acceptInvite.bind(null, invite.id)}>
                      <button className="button button-primary button-tiny">Join as Writer</button>
                    </ActionForm>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className={`muted ${styles.empty}`}>You&rsquo;re all caught up.</p>
          )}
        </section>
      </div>
    </Dropdown>
  );
}

function YouMenu({ profile }: { profile: { username: string; author_color: string; theme: Theme } }) {
  return (
    <Dropdown
      label="Your account"
      triggerClassName={styles.avatarButton}
      panelClassName={styles.menu}
      trigger={<Avatar name={profile.username} color={profile.author_color} />}
    >
      <Link href={`/u/${profile.username}`} className={styles.who}>
        <Avatar name={profile.username} color={profile.author_color} />
        <span>
          <b>{profile.username}</b>
          <small>View profile</small>
        </span>
      </Link>
      <Link href="/settings" className={styles.menuItem}>
        Settings
      </Link>
      <div className={`${styles.menuItem} ${styles.theme}`}>
        Theme
        <ThemeSwitch theme={profile.theme} />
      </div>
      <hr className={styles.divider} />
      <form action={signOut}>
        <button className={styles.menuItem}>Sign out</button>
      </form>
    </Dropdown>
  );
}

function Badge({ count }: { count: number }) {
  return count ? (
    <span className="badge" aria-hidden>
      {count}
    </span>
  ) : null;
}

function FriendsIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <circle cx="7.5" cy="7" r="3" />
      <path d="M2 16.5c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5" />
      <path d="M13 4.2a3 3 0 0 1 0 5.6M15 12.3c1.6.6 2.6 2 3 4.2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 20 20" aria-hidden>
      <path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5.5 2 6H3c.5-.5 2-2 2-6Z" />
      <path d="M8.2 17a2 2 0 0 0 3.6 0" />
    </svg>
  );
}
