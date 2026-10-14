import { Bar, Loading } from "@/components/Skeleton";
import { ProfileFormSkeleton } from "@/components/ProfileFormSkeleton";

export default function SettingsLoading() {
  return (
    <Loading>
      <div className="page">
        <h1>Settings</h1>
        <ProfileFormSkeleton showBio />
        <section className="section">
          <h2>Theme</h2>
          <p className="muted">Auto follows your device&rsquo;s light or dark setting.</p>
          <Bar width={170} height={28} round />
        </section>
        <section className="section">
          <h2>Presence</h2>
          <p className="muted">
            Friends see when you&rsquo;re online, and which Story you&rsquo;re writing in if they can read it.
            Co-writers always see you inside a Story you share.
          </p>
          <Bar width="12rem" height={24} />
        </section>
        <section className="section">
          <h2>Your data</h2>
          <p className="muted">Your profile, Friends, Notes and Story Chat messages, plus a Markdown copy of each Story you write in.</p>
          <Bar width="13rem" height={40} />
        </section>
        <section className="section">
          <h2>Delete account</h2>
          <p className="muted">Remove your account and sign out everywhere.</p>
          <Bar width="9rem" height={40} />
        </section>
      </div>
    </Loading>
  );
}
