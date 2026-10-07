import styles from "./AuthorBadge.module.css";

export function AuthorBadge({ username, color }: { username: string; color: string }) {
  return (
    <span className={styles.badge}>
      <span className={styles.dot} style={{ background: color }} aria-hidden />
      {username}
    </span>
  );
}
