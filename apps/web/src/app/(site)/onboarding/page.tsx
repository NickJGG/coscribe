import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { safeNext } from "@/lib/safe-next";
import { AUTHOR_COLORS } from "@/lib/profile-rules";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const { next } = await props.searchParams;
  const nextPath = typeof next === "string" ? safeNext(next) : undefined;

  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/onboarding");
  if (viewer.profile) redirect(nextPath ?? `/u/${viewer.profile.username}`);

  // Vary the default color per user so new writers don't all start out the same.
  const defaultColor = AUTHOR_COLORS[parseInt(viewer.userId.slice(0, 8), 16) % AUTHOR_COLORS.length]!;

  return (
    <div className="page">
      <h1>Welcome to Coscribe</h1>
      <p className="muted">
        Pick the name your friends will find you by, and the color your words show up in.
      </p>
      <ProfileForm
        initial={{ username: "", authorColor: defaultColor, bio: "" }}
        next={nextPath && nextPath !== "/" ? nextPath : undefined}
        submitLabel="Start writing"
      />
    </div>
  );
}
