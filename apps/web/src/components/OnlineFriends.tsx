"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { Avatar } from "./Avatar";
import { useDropdownOpen } from "./Dropdown";
import styles from "./SiteHeader.module.css";

type OnlineFriend = Database["public"]["Functions"]["friends_presence"]["Returns"][number];

/**
 * The Friends dropdown's "Online now", fetched each time it opens. The database decides what to reveal:
 * where a Friend is writing shows only if you could read that Story anyway.
 */
export function OnlineFriends() {
  const supabase = useMemo(() => createClient(), []);
  const open = useDropdownOpen();
  const [friends, setFriends] = useState<OnlineFriend[]>([]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void supabase.rpc("friends_presence").then(({ data }) => {
      if (live && data) setFriends(data);
    });
    return () => {
      live = false;
    };
  }, [supabase, open]);

  if (!friends.length) return null;

  return (
    <section className={styles.panelSection}>
      <h3 className="smallcaps">Online now</h3>
      {friends.map((friend) => (
        <Link
          key={friend.user_id}
          href={
            friend.chapter_id
              ? `/stories/${friend.story_id}/chapters/${friend.chapter_id}`
              : friend.story_id
                ? `/stories/${friend.story_id}`
                : `/u/${friend.username}`
          }
          className={styles.personRow}
        >
          <Avatar name={friend.username} color={friend.author_color} />
          <span className={styles.personText}>
            <span className={styles.personName}>{friend.username}</span>
            <small className={styles.where}>
              {friend.story_id ? (
                <>
                  Writing in <span className={styles.storyName}>{friend.story_title}</span>
                  {friend.chapter_title && <> · {friend.chapter_title}</>}
                </>
              ) : (
                "Online"
              )}
            </small>
          </span>
          <span className={styles.onlineDot} aria-hidden />
        </Link>
      ))}
    </section>
  );
}
