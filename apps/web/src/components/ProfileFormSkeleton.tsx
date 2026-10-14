import { Bar, Line } from "./Skeleton";
import styles from "./ProfileForm.module.css";
import swatches from "./ColorSwatches.module.css";

/** ProfileForm's layout for a loading.tsx, with its fixed labels as real text. */
export function ProfileFormSkeleton({ showBio = false }: { showBio?: boolean }) {
  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <span className={styles.label}>Username</span>
        <Bar width={320} height={40} />
        <Line className={`muted ${styles.hint}`} width="18rem" />
      </div>
      {showBio && (
        <div className={styles.field}>
          <span className={styles.label}>Bio</span>
          <Bar width="min(100%, 480px)" height={64} />
          <Line className={`muted ${styles.hint}`} width="min(100%, 22rem)" />
        </div>
      )}
      <div className={styles.field}>
        <span className={styles.label}>Author color</span>
        <p className={`muted ${styles.hint}`}>
          Your cursor and your text tint, wherever you write. In a Story where another Writer already has it, you
          get the nearest free color.
        </p>
        <div className={swatches.swatches}>
          {Array.from({ length: 12 }, (_, i) => (
            <Bar key={i} width={40} height={40} round />
          ))}
        </div>
      </div>
      <div>
        <Bar width={110} height={40} />
      </div>
    </div>
  );
}
