import Link from "next/link";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <Link href="/changelog">Changelog</Link>
      <Link href="/privacy">Privacy</Link>
    </footer>
  );
}
