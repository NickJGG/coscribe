import styles from "./Switch.module.css";

/** An on/off control labelled by its children, like "Show authors", or by `label` when the text sits elsewhere. */
export function Switch({
  checked,
  onChange,
  className,
  label,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.switch} ${className ?? ""}`}
      onClick={() => onChange(!checked)}
    >
      {children}
      <span className={styles.track} aria-hidden />
    </button>
  );
}
