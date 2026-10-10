import { Line, Lines, Loading } from "@/components/Skeleton";
import live from "@/components/LiveDocument.module.css";
import styles from "./chapter.module.css";

export default function ChapterLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.meta}>
            <Line className="smallcaps" width="5rem" />
          </div>
          <Line as="h1" className={styles.title} width="50%" />
        </header>
        <Lines count={9} className={live.prose} />
      </div>
    </Loading>
  );
}
