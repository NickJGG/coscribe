import Link from "next/link";
import styles from "./reader.module.css";

type Section = "contents" | "bible" | "credits" | "chapter";

export function ReaderNav({
  story,
  current,
  hasBible,
}: {
  story: { id: string; title: string };
  current: Section;
  hasBible: boolean;
}) {
  const base = `/stories/${story.id}/read`;
  const links: [Section, string, string][] = [
    ["contents", "Contents", base],
    ...(hasBible ? [["bible", "Story Bible", `${base}/bible`] as [Section, string, string]] : []),
    ["credits", "Credits", `${base}/credits`],
  ];

  return (
    <nav className={styles.nav} aria-label="Reader View">
      <Link href={`/stories/${story.id}`} className={styles.navStory}>
        {story.title}
      </Link>
      <ul className={styles.navLinks}>
        {links.map(([section, label, href]) => (
          <li key={section}>
            <Link href={href} aria-current={section === current ? "page" : undefined}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Unavailable() {
  return <p className={styles.empty}>The text couldn&rsquo;t be loaded right now. Try again in a moment.</p>;
}
