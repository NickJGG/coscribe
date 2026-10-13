import Link from "next/link";
import { Bar, Line, Loading } from "@/components/Skeleton";
import fields from "@/components/StoryFields.module.css";
import styles from "./new.module.css";

export default function NewStoryLoading() {
  return (
    <Loading>
      <div className="page">
        <Link href="/stories" className={styles.back}>
          &larr; Your stories
        </Link>
        <div className={styles.head}>
          <h1>Start a story</h1>
          <Line className="muted" width="26rem" />
        </div>
        <div className="tabs">
          <span className="tab">Blank</span>
          <span className="tab">Start from a file</span>
        </div>
        <div className={styles.form}>
          <div className={fields.field}>
            <span className={fields.label}>Title</span>
            <Bar width={320} height={40} />
          </div>
          <div className={fields.field}>
            <span className={fields.label}>Blurb</span>
            <Bar width={480} height={90} />
          </div>
          <div className={fields.field}>
            <span className={fields.label}>Visibility</span>
            <Bar width="14rem" />
            <Bar width="22rem" />
          </div>
        </div>
      </div>
    </Loading>
  );
}
