import { Bar, Loading } from "@/components/Skeleton";
import styles from "./home.module.css";

export default function HomeLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.copy}>
            <h1>Write one story together, live.</h1>
            <p className="muted">
              Invite your friends, open a Chapter, and type into the same page at the same time. Public stories can be
              watched as they&rsquo;re written.
            </p>
            <div className={styles.ctas}>
              <Bar width={130} height={40} />
              <Bar width={220} height={40} />
            </div>
          </div>
          <Bar width="100%" height={300} />
        </div>
      </div>
    </Loading>
  );
}
