import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { safeNext } from "@/lib/safe-next";
import { SignInButtons } from "./SignInButtons";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;
  const nextPath = safeNext(next);

  if (await getViewer()) redirect(nextPath);

  return (
    <div className="page">
      <h1>Sign in</h1>
      <p className="muted">
        Writers sign in to pick a username and an author color. You don&rsquo;t need an account to
        watch a public story.
      </p>
      {error && (
        <p role="alert" style={{ color: "var(--danger)" }}>
          That sign-in didn&rsquo;t go through. Try again.
        </p>
      )}
      <SignInButtons next={nextPath} />
    </div>
  );
}
