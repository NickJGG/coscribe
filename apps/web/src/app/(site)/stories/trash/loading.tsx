import Link from "next/link";
import { Bar, Line, Loading } from "@/components/Skeleton";
import styles from "../(list)/stories.module.css";

export default function StoryTrashLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <Link href="/stories" className={styles.back}>
          &larr; Your stories
        </Link>
        <div className={styles.head}>
          <h1>Trash</h1>
          <Line className="muted" width="24rem" />
        </div>
        <div className="rows">
          {["10rem", "14rem"].map((width, i) => (
            <div key={i} className="row">
              <div>
                <Bar width={width} />
                <Line className={`muted ${styles.trashMeta}`} width="11rem" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}
