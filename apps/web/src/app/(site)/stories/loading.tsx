import { Bar, Line, Loading } from "@/components/Skeleton";
import styles from "./stories.module.css";

export default function StoriesLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <h1>Your stories</h1>
        <ul className={styles.list}>
          {[55, 70, 40, 62].map((width, i) => (
            <li key={i} className={styles.story}>
              <div className={styles.main}>
                <Line className={styles.title} width={`${width}%`} />
                <Line className={styles.sub} width="12rem" />
              </div>
              <div className={styles.side}>
                <Bar width={66} height={26} round />
                <Bar width={140} height={4} round />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Loading>
  );
}
