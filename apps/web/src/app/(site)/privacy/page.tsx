import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

const CONTACT = "nick.gilliam2@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="page">
      <div>
        <h1>Privacy</h1>
        <p className="muted">Last updated October 14, 2026</p>
      </div>

      <p>
        Coscribe is a small site for writing stories with friends. This page says what it keeps about
        you and why.
      </p>

      <section>
        <h2>Signing in</h2>
        <p>
          You sign in with Google or Discord. Coscribe receives your email address and the basic
          profile the provider shares (such as your name and picture), and uses them only to sign you
          in. You never give Coscribe a password.
        </p>
      </section>

      <section>
        <h2>What you add</h2>
        <p>
          Your username, Author Color, and settings; your Friends and Invites; and what you write:
          Chapters, Story Bible Entries, notes, and Story Chat messages, including who wrote which
          text. Your username and profile page are public. A Public story can be read by anyone; a
          Private story only by its Writers. While you have a story open, others in it can see
          that you&apos;re there.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>Only the cookies that keep you signed in. No analytics, tracking, or ads.</p>
      </section>

      <section>
        <h2>Where it&apos;s stored</h2>
        <p>
          Accounts and stories are stored with Supabase. The site runs on Vercel, and live editing
          runs on Fly.io. Your information isn&apos;t sold or shared with anyone else.
        </p>
      </section>

      <section>
        <h2>Deleting your data</h2>
        <p>
          Delete your account from <Link href="/settings">Settings</Link>. Your profile, Friends and
          Invites go, along with Stories only you write in; what you wrote in other Writers&apos;
          Stories stays there, credited to &ldquo;A deleted account&rdquo;. Email{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> to ask about what&apos;s stored.
        </p>
      </section>
    </div>
  );
}
