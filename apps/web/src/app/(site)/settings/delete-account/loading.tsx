import Link from "next/link";
import { Bar, Line, Loading } from "@/components/Skeleton";
import { Card, InlineRow, Sub } from "@/components/SettingsCard";
import styles from "./delete-account.module.css";

export default function DeleteAccountLoading() {
  return (
    <Loading>
      <div className="page">
        <Link href="/settings" className={styles.back}>
          &larr; Settings
        </Link>
        <div className={styles.head}>
          <h1>Delete your account</h1>
          <p className="muted">This can&rsquo;t be undone.</p>
        </div>

        <Card title="What happens to your writing">
          <Sub>
            <div className={styles.meta}>
              <span>Stays in other Writers&rsquo; Stories, credited to &ldquo;A deleted account&rdquo;</span>
              <small>Your text in Chapters and the Story Bible, your Notes and your Story Chat messages.</small>
            </div>
          </Sub>
          <Sub>
            <div className={styles.meta}>
              <span>Deleted</span>
              <small>Your profile, username, Bio, Featured Passages, Friends and Invites.</small>
            </div>
          </Sub>
          <Sub>
            <p className={`muted ${styles.note}`}>
              <u>Download your data first</u>, with a Markdown copy of each Story you write in.
            </p>
          </Sub>
        </Card>

        <Card title="Delete account" danger>
          {["10rem", "14rem"].map((width, i) => (
            <Sub key={i}>
              <InlineRow>
                <Line className={styles.title} width={width} />
                <Bar width="5rem" height={22} round />
              </InlineRow>
            </Sub>
          ))}
          <Sub>
            <div className={styles.confirm}>
              <Bar width="11rem" />
              <Bar width={320} height={40} />
              <div>
                <Bar width="8rem" height={40} />
              </div>
            </div>
          </Sub>
        </Card>
      </div>
    </Loading>
  );
}
