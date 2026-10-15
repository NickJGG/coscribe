import { Loading } from "@/components/Skeleton";
import { UpdateCardSkeleton } from "@/components/UpdateCard";
import styles from "../changelog.module.css";

export default function ChangelogLoading() {
  return (
    <Loading>
      <div className="page">
        <div className={styles.head}>
          <h1>Changelog</h1>
          <p className="muted">What&rsquo;s new in Coscribe.</p>
        </div>
        <UpdateCardSkeleton />
        <UpdateCardSkeleton />
      </div>
    </Loading>
  );
}
