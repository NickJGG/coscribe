import styles from "./reader.module.css";

export function Unavailable() {
  return <p className={styles.empty}>The text couldn&rsquo;t be loaded right now. Try again in a moment.</p>;
}
