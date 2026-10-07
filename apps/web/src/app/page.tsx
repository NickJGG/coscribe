import Link from "next/link";
import { getViewer } from "@/lib/viewer";

export default async function Home() {
  const viewer = await getViewer();

  return (
    <div className="page">
      <h1>Write one story together, live.</h1>
      <p className="muted">
        Invite your friends, open a chapter, and type into the same page at the same time.
        Public stories can be watched as they&rsquo;re written, by anyone with the link.
      </p>
      <div>
        {viewer?.profile ? (
          <Link href={`/u/${viewer.profile.username}`} className="button button-primary">
            Your profile
          </Link>
        ) : viewer ? (
          <Link href="/onboarding" className="button button-primary">
            Choose your username
          </Link>
        ) : (
          <Link href="/login" className="button button-primary">
            Sign in to start writing
          </Link>
        )}
      </div>
    </div>
  );
}
