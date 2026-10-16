import { Bar, Line, Loading } from "@/components/Skeleton";
import { StorySectionSkeleton } from "@/components/StoryCard";
import styles from "./profile.module.css";

export default function ProfileLoading() {
  return (
    <Loading>
      <div className={styles.page} style={{ "--author": "var(--hair)" } as React.CSSProperties}>
        <div className={styles.layout}>
          <aside className={styles.aside}>
            <span className={styles.avatar} />
            <div className={styles.who}>
              <Line as="h1" width="8rem" />
              <Line className={styles.bio} width="100%" />
              <Line className={`muted ${styles.since}`} width="85%" />
            </div>
            <Bar width="6.5rem" height={32} />
          </aside>
          <div className={styles.work}>
            <div className={styles.heatmap}>
              <Line className={styles.label} width="7rem" />
              <Bar width="100%" height={112} />
            </div>
            <StorySectionSkeleton titleWidth="9rem" cards={["60%", "75%", "50%"]} />
          </div>
        </div>
      </div>
    </Loading>
  );
}
