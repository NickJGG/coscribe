import { authorColorCss } from "@/lib/profile-rules";
import styles from "./Avatar.module.css";

export type AvatarPerson = { id: string; name: string; color: string };
type Size = "sm" | "md";

/** A person's initial inside a ring of their Author Color. Decorative: show or announce the name beside it. */
export function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: Size }) {
  return (
    <span
      className={styles.avatar}
      data-size={size}
      style={{ "--c": authorColorCss(color) } as React.CSSProperties}
      data-tip={name}
      aria-hidden
    >
      {[...name][0]?.toUpperCase()}
    </span>
  );
}

/** Overlapping avatars, with "+N" past `max`. Announced as the list of names. */
export function AvatarStack({ people, max = 4, size = "md" }: { people: AvatarPerson[]; max?: number; size?: Size }) {
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const rest = people.length - shown.length;

  return (
    <span className={styles.stack} role="img" aria-label={people.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} color={p.color} size={size} />
      ))}
      {rest > 0 && (
        <span className={`${styles.avatar} ${styles.more}`} data-size={size} aria-hidden>
          +{rest}
        </span>
      )}
    </span>
  );
}
