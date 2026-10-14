import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { ProfileForm } from "@/components/ProfileForm";
import { Card, InlineRow, Sub } from "@/components/SettingsCard";
import { ShowOnlineSwitch } from "@/components/ShowOnlineSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/settings");
  if (!viewer.profile) redirect("/onboarding?next=/settings");
  const { username } = viewer.profile;

  return (
    <div className="page">
      <h1>Settings</h1>

      <Card
        title="Profile"
        description={
          <>
            What people see on <Link href={`/u/${username}`}>your profile</Link> and beside your writing.
          </>
        }
      >
        <Sub>
          <ProfileForm
            initial={{
              username,
              authorColor: viewer.profile.author_color,
              bio: viewer.profile.bio ?? "",
            }}
            submitLabel="Save"
            showBio
          />
        </Sub>
      </Card>

      <Card title="Preferences">
        <Sub>
          <InlineRow>
            <div>
              <h3>Theme</h3>
              <p className="muted">Auto follows your device&rsquo;s light or dark setting.</p>
            </div>
            <ThemeSwitch theme={viewer.profile.theme} />
          </InlineRow>
        </Sub>
        <Sub>
          <InlineRow>
            <div>
              <h3>Show me as online</h3>
              <p className="muted">
                Friends see when you&rsquo;re online, and which Story you&rsquo;re writing in if they can read it.
                Co-writers always see you inside a Story you share.
              </p>
            </div>
            <ShowOnlineSwitch show={viewer.profile.show_online} />
          </InlineRow>
        </Sub>
      </Card>

      <Card title="Your data">
        <Sub>
          <InlineRow>
            <div>
              <h3>Download your data</h3>
              <p className="muted">
                Your profile, Friends, Notes and Story Chat messages, plus a Markdown copy of each Story you write in.
              </p>
            </div>
            <a href="/settings/data" className="button" download>
              Download (.zip)
            </a>
          </InlineRow>
        </Sub>
      </Card>

      <Card title="Leave Coscribe" danger>
        <Sub>
          <InlineRow>
            <div>
              <h3>Delete account</h3>
              <p className="muted">
                Remove your account and sign out everywhere. You&rsquo;ll hand over any Stories you Host first.
              </p>
            </div>
            <Link href="/settings/delete-account" className="button button-danger">
              Delete account&hellip;
            </Link>
          </InlineRow>
        </Sub>
      </Card>
    </div>
  );
}
