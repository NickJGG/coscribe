import type { Metadata } from "next";
import { UpdateCard } from "@/components/UpdateCard";
import { getUpdates } from "@/lib/changelog";
import styles from "../changelog.module.css";

export const metadata: Metadata = { title: "Changelog" };

export default async function ChangelogPage() {
  const updates = await getUpdates();

  return (
    <div className="page">
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
