import { Line, Lines, Loading } from "@/components/Skeleton";
import styles from "../reader.module.css";

export default function ReaderBibleLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <header className={styles.chapterHead}>
          <h1 className={styles.chapterTitle}>Story Bible</h1>
        </header>
        <section className={styles.typeSection}>
          <Line className={styles.eyebrow} width="6rem" />
          {["8rem", "11rem"].map((width, i) => (
            <div key={i} className={styles.entry}>
              <Line className={styles.entryName} width={width} />
              <Line className={styles.entryDescription} width="60%" />
              <Lines count={3} className={styles.text} />
            </div>
          ))}
        </section>
      </div>
    </Loading>
  );
}
