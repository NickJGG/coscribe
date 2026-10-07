import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { ProfileForm } from "@/components/ProfileForm";
import { ShowOnlineSwitch } from "@/components/ShowOnlineSwitch";
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
      <section className="section">
        <h2>Presence</h2>
        <p className="muted">
          Friends see when you&rsquo;re online, and which Story you&rsquo;re writing in if they can read it.
          Co-writers always see you inside a Story you share.
        </p>
        <div>
          <ShowOnlineSwitch show={viewer.profile.show_online} />
        </div>
      </section>
    </div>
  );
}
