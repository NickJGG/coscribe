import { Bar, Loading } from "@/components/Skeleton";
import { StorySectionSkeleton } from "@/components/StoryCard";
import styles from "./stories.module.css";

export default function StoriesLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Your stories</h1>
          <Bar width={100} height={32} />
        </div>
        <StorySectionSkeleton titleWidth="9rem" cards={["55%", "70%", "40%"]} />
      </div>
    </Loading>
  );
}
