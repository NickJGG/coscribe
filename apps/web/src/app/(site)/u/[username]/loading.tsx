import { Bar, Line, Loading } from "@/components/Skeleton";
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
            <section className={styles.section}>
              <Line as="h2" width="9rem" />
              <ul className={styles.grid}>
                {[60, 75, 50].map((width, i) => (
                  <li key={i} className={`${styles.card} ${styles.manuscript}`}>
                    <span className={styles.spine} />
                    <div className={styles.body}>
                      <Line className={styles.role} width="3rem" />
                      <Line className={styles.title} width={`${width}%`} />
                      <Line className={styles.blurb} width="100%" />
                      <Line className={styles.foot} width="7rem" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </Loading>
  );
}
