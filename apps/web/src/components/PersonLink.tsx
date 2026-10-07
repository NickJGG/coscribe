import Link from "next/link";
import { AuthorBadge } from "./AuthorBadge";
import styles from "./PersonLink.module.css";

export function PersonLink({ person }: { person: { username: string; author_color: string } }) {
  return (
    <Link href={`/u/${person.username}`} className={styles.link}>
      <AuthorBadge username={person.username} color={person.author_color} />
    </Link>
  );
}
