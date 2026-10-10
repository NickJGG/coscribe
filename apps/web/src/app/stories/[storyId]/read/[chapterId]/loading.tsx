import { Line, Lines, Loading } from "@/components/Skeleton";
import styles from "../reader.module.css";

export default function ReaderChapterLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <header className={styles.chapterHead}>
          <Line className={styles.eyebrow} width="10rem" />
          <Line as="h1" className={styles.chapterTitle} width="14rem" />
        </header>
        <Lines count={12} className={styles.text} />
      </div>
    </Loading>
  );
}
