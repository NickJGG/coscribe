import { Bar, Line, Loading } from "@/components/Skeleton";
import styles from "./profile.module.css";

export default function ProfileLoading() {
  return (
    <Loading>
      <div className="page" style={{ "--author": "var(--hair)" } as React.CSSProperties}>
        <header className={styles.header}>
          <Bar width={64} height={64} round />
          <div>
            <Line as="h1" width="10rem" />
            <Line className="muted" width="16rem" />
          </div>
        </header>
        <section className={styles.section}>
          <h2>Stories</h2>
          <ul className="rows">
            {[55, 40, 62].map((width, i) => (
              <li key={i} className="row">
                <Line className={styles.storyTitle} width={`${width}%`} />
                <Bar width="9rem" height={22} round />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Loading>
  );
}
