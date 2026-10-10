import { Loading } from "@/components/Skeleton";
import styles from "./search.module.css";

/** Results are found in the browser, so the page's own first state is the skeleton. */
export default function SearchLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <p className="muted">Searching…</p>
      </div>
    </Loading>
  );
}
