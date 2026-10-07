import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { signOut } from "@/lib/actions/auth";
import { Avatar } from "./Avatar";
import styles from "./SiteHeader.module.css";

export async function SiteHeader() {
  const viewer = await getViewer();
  const counts = viewer?.profile ? await pendingCounts(viewer.userId) : null;

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        Coscribe
      </Link>
      <nav className={styles.nav}>
        {viewer?.profile ? (
          <>
            <NavLink href="/stories" label="Stories" count={counts?.invites} />
            <NavLink href="/friends" label="Friends" count={counts?.requests} />
            <Link href={`/u/${viewer.profile.username}`} className={styles.me}>
              <Avatar name={viewer.profile.username} color={viewer.profile.author_color} />
              {viewer.profile.username}
            </Link>
            <Link href="/settings">Settings</Link>
          </>
        ) : viewer ? (
          <Link href="/onboarding">Finish sign-up</Link>
        ) : (
          <Link href="/login" className="button">
            Sign in
          </Link>
        )}
        {viewer && (
          <form action={signOut}>
            <button className="link-button">Sign out</button>
          </form>
        )}
      </nav>
    </header>
  );
}

function NavLink({ href, label, count }: { href: string; label: string; count?: number }) {
  return (
    <Link href={href}>
      {label}
      {count ? (
        <span className={styles.count}>
          {count}
          <span className="sr-only"> waiting</span>
        </span>
      ) : null}
    </Link>
  );
}

async function pendingCounts(userId: string) {
  const supabase = await createClient();
  const [invites, requests] = await Promise.all([
    supabase
      .from("invites")
      .select("id", { count: "exact", head: true })
      .eq("invitee_id", userId)
      .is("used_at", null),
    supabase
      .from("friendships")
      .select("requester_id", { count: "exact", head: true })
      .eq("addressee_id", userId)
      .eq("status", "pending"),
  ]);
  return { invites: invites.count ?? 0, requests: requests.count ?? 0 };
}
