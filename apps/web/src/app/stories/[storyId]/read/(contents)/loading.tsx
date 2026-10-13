import { Bar, Line, Loading } from "@/components/Skeleton";
import styles from "../reader.module.css";

export default function ReaderContentsLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <header className={styles.titlePage}>
          <p className={styles.eyebrow}>A Coscribe story</p>
          <Line as="h1" className={styles.bookTitle} width="16rem" />
          <Line className={styles.blurb} width="22rem" />
          <Line className={styles.byline} width="12rem" />
          <Line className="muted" width="13rem" />
          <div className={`row-actions ${styles.titleActions}`}>
            <Bar width={140} height={40} />
            <Bar width={120} height={40} />
          </div>
        </header>

        <section className="section">
          <h2>Contents</h2>
          <ol className={styles.contents}>
            {["14rem", "10rem", "16rem", "12rem"].map((width, i) => (
              <li key={i}>
                <Bar width={width} />
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Loading>
  );
}
