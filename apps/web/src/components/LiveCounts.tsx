import styles from "./LiveCounts.module.css";

/** "● 3 writing  9 watching" for a Public Story. Counts only: nobody is named. */
export function LiveCounts({ writers, viewers }: { writers: number; viewers: number }) {
  return (
    <span className={styles.counts}>
      <span className={styles.live}>{writers} writing</span>
      {viewers > 0 && <span>{viewers} watching</span>}
    </span>
  );
}

/** The pulsing live dot before `children`. */
export function LiveLabel({ children }: { children: React.ReactNode }) {
  return <span className={styles.live}>{children}</span>;
}
