import Link from "next/link";
import type { Relation } from "@/lib/friends";
import { acceptFriendRequest, sendFriendRequest } from "@/lib/actions/friends";
import { ActionForm } from "@/components/ActionForm";
import styles from "./profile.module.css";

/** Buttons only for what the viewer can do; settled states are plain text. */
export function FriendAction({
  relation,
  user,
}: {
  relation: Relation | "self";
  user: { id: string; username: string };
}) {
  switch (relation) {
    case "self":
      return (
        <div className={styles.action}>
          <Link href="/settings" className="button button-small">
            Edit profile
          </Link>
        </div>
      );
    case "friends":
      return (
        <div className={styles.action}>
          <span className={styles.state}>
            <svg className={styles.check} viewBox="0 0 12 12" aria-hidden>
              <path d="M2.5 6.5l2.2 2.2L9.5 3.8" />
            </svg>
            Friends
          </span>
        </div>
      );
    case "outgoing":
      return (
        <div className={styles.action}>
          <span className={styles.state}>Friend request sent</span>
        </div>
      );
    case "incoming":
      return (
        <ActionForm action={acceptFriendRequest.bind(null, user.id)} className={styles.action}>
          <span className={styles.note}>{user.username} sent you a friend request</span>
          <button className="button button-primary button-small">Accept request</button>
        </ActionForm>
      );
    case "none":
      return (
        <ActionForm action={sendFriendRequest.bind(null, user.id)} className={styles.action}>
          <button className="button button-small">Add friend</button>
        </ActionForm>
      );
  }
}
