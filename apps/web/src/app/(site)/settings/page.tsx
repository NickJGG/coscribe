import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { ProfileForm } from "@/components/ProfileForm";
import { ThemeSwitch } from "@/components/ThemeSwitch";

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
      <section className="section">
        <h2>Theme</h2>
        <p className="muted">Auto follows your device&rsquo;s light or dark setting.</p>
        <div>
          <ThemeSwitch theme={viewer.profile.theme} />
        </div>
      </section>
    </div>
  );
}
