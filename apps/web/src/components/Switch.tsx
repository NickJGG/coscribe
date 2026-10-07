import styles from "./Switch.module.css";

/** An on/off control labelled by its children, like "Show authors". */
export function Switch({
  checked,
  onChange,
  className,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`${styles.switch} ${className ?? ""}`}
      onClick={() => onChange(!checked)}
    >
      {children}
      <span className={styles.track} aria-hidden />
    </button>
  );
}
