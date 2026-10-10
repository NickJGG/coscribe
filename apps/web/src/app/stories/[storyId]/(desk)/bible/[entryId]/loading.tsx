import { Line, Lines, Loading } from "@/components/Skeleton";
import live from "@/components/LiveDocument.module.css";
import styles from "./entry.module.css";

export default function EntryLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.meta}>
            <Line className="smallcaps" width="4.5rem" />
            <span className="muted">Story Bible</span>
          </div>
          <Line as="h1" className={styles.title} width="40%" />
          <Line className={styles.description} width="70%" />
        </header>
        <Lines count={5} className={live.prose} />
      </div>
    </Loading>
  );
}
