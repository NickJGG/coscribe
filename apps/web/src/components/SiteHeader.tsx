import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { signOut } from "@/lib/actions/auth";
import { AuthorBadge } from "./AuthorBadge";
import styles from "./SiteHeader.module.css";

export async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        Coscribe
      </Link>
      <nav className={styles.nav}>
        {viewer?.profile ? (
          <>
            <Link href={`/u/${viewer.profile.username}`} className={styles.me}>
              <AuthorBadge username={viewer.profile.username} color={viewer.profile.author_color} />
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
