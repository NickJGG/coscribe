import { Bar, Line, Loading } from "@/components/Skeleton";
import { BrowseButton } from "./Overview";
import styles from "./overview.module.css";

export default function OverviewLoading() {
  return (
    <Loading>
      <div className={styles.page}>
        <header className={styles.heading}>
          <Line className="smallcaps" width="16rem" />
          <Line as="h1" className={styles.title} width="60%" />
          <Line className={styles.blurb} width="85%" />
          <span className={styles.byline}>
            <Bar width={66} height={26} round />
            <Bar width="14rem" />
          </span>
          <div className={`row-actions ${styles.actions}`}>
            <Bar width={180} height={40} />
            <Bar width={120} height={40} />
            <Bar width={90} height={40} />
          </div>
        </header>

        <BrowseButton />

        <div className={styles.columns}>
          <div className={styles.lead}>
            <section className={styles.section}>
              <h2 className="smallcaps">Recently edited</h2>
              <div className={styles.chapters}>
                {[70, 55, 62].map((width, i) => (
                  <div key={i} className={styles.chapter}>
                    <Line className={styles.chapterNumber} width="0.6em" />
                    <Line className={styles.chapterTitle} width={`${width}%`} />
                    <Line className={styles.chapterSub} width="45%" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className={`${styles.section} ${styles.side}`}>
            <h2 className="smallcaps">Writers</h2>
            <Bar width="100%" height={4} round />
            <div className={styles.writers}>
              {[6, 8, 5].map((width, i) => (
                <div key={i} className={styles.writer}>
                  <Bar width={26} height={26} round />
                  <span className={styles.writerText}>
                    <Bar width={`${width}rem`} />
                    <span>
                      <Bar width="3.5rem" />
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Loading>
  );
}
