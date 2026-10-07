import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { ProfileForm } from "@/components/ProfileForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/settings");
  if (!viewer.profile) redirect("/onboarding?next=/settings");

  return (
    <div className="page">
      <h1>Settings</h1>
      <ProfileForm
        initial={{ username: viewer.profile.username, authorColor: viewer.profile.author_color }}
        submitLabel="Save"
      />
    </div>
  );
}
