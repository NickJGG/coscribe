import { Bar, Line, Loading } from "@/components/Skeleton";
import styles from "../reader.module.css";

export default function ReaderCreditsLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <header className={styles.chapterHead}>
          <h1 className={styles.chapterTitle}>Credits</h1>
          <Line className="muted" width="18rem" />
        </header>
        <div className={styles.credits}>
          {["7rem", "9rem", "6rem"].map((width, i) => (
            <div key={i} className={styles.credit}>
              <div className={styles.creditName}>
                <Bar width={width} />
                <Bar width="2.5rem" />
              </div>
              <Bar width="100%" height={8} round />
              <Line className={styles.creditDetail} width="14rem" />
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}
