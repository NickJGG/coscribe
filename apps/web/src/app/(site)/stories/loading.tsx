import { Loading } from "@/components/Skeleton";
import { StorySectionSkeleton } from "@/components/StoryCard";
import styles from "./stories.module.css";

export default function StoriesLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <h1>Your stories</h1>
        <StorySectionSkeleton titleWidth="9rem" cards={["55%", "70%", "40%"]} />
      </div>
    </Loading>
  );
}
