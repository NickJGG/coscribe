import Link from "next/link";
import { Loading } from "@/components/Skeleton";
import { UpdateCardSkeleton } from "@/components/UpdateCard";
import styles from "../changelog.module.css";

export default function UpdateLoading() {
  return (
    <Loading>
      <div className="page">
        <Link href="/changelog" className={styles.back}>
          &larr; All updates
        </Link>
        <UpdateCardSkeleton standalone />
      </div>
    </Loading>
  );
}
