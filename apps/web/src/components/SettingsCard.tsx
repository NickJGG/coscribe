import styles from "./SettingsCard.module.css";

/** A bordered settings card: a heading, an optional one-line description, then `Sub`sections split by hairlines. */
export function Card({
  title,
  description,
  danger,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={danger ? `${styles.card} ${styles.danger}` : styles.card}>
      <div className={styles.cardHead}>
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Sub({ children }: { children: React.ReactNode }) {
  return <div className={styles.sub}>{children}</div>;
}

/** A heading and its description on the left, one action on the right; wraps under on phones. */
export function InlineRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.inlineRow}>{children}</div>;
}
