import type { Metadata } from "next";
import { MarkChangelogSeen } from "@/components/MarkChangelogSeen";
import { UpdateCard } from "@/components/UpdateCard";
import { getUpdates, unseenUpdateDate } from "@/lib/changelog";
import { getViewer } from "@/lib/viewer";
import styles from "../changelog.module.css";

export const metadata: Metadata = { title: "Changelog" };

export default async function ChangelogPage() {
  const updates = await getUpdates();
  const profile = (await getViewer())?.profile;
  const unseen = profile && (await unseenUpdateDate(profile.changelog_seen));

  return (
    <div className="page">
      {unseen && <MarkChangelogSeen date={unseen} />}
      <div className={styles.head}>
        <h1>Changelog</h1>
        <p className="muted">What&rsquo;s new in Coscribe.</p>
      </div>
      {updates.length ? (
        updates.map((update) => <UpdateCard key={update.date} update={update} />)
      ) : (
        <p className="muted">No updates yet.</p>
      )}
    </div>
  );
}
