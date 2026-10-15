import Link from "next/link";
import { formatUpdateDate, type Update, type UpdateImage } from "@/lib/changelog";
import { Line, Lines } from "./Skeleton";
import styles from "./UpdateCard.module.css";

/** One changelog update. In the feed its title is an h2 linking to the update; on the update's own page, an h1. */
export function UpdateCard({ update, standalone }: { update: Update; standalone?: boolean }) {
  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <time className="smallcaps" dateTime={update.date}>
          {formatUpdateDate(update.date)}
        </time>
        {standalone ? (
          <h1 className={styles.title}>{update.title}</h1>
        ) : (
          <h2 className={styles.title}>
            <Link href={`/changelog/${update.date}`}>{update.title}</Link>
          </h2>
        )}
      </header>
      {update.groups.map((group) => (
        <section key={group.kind} className={styles.group}>
          <h3 className={styles.label}>{group.kind}</h3>
          <ul className={styles.lines}>
            {group.lines.map((line, i) => (
              <li key={i}>
                <strong className={styles.lead}>{line.lead}</strong>
                {line.html && <p className={styles.text} dangerouslySetInnerHTML={{ __html: line.html }} />}
                {line.images.map((image) => (
                  <Shot key={image.src} image={image} />
                ))}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

/** Both variants render and CSS picks one, since `<picture media>` can't see a theme pinned on <html>. */
function Shot({ image }: { image: UpdateImage }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- screenshots of unknown size, swapped by theme in CSS */}
      <img className={image.darkSrc ? styles.light : styles.image} src={image.src} alt={image.alt} loading="lazy" />
      {image.darkSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.dark} src={image.darkSrc} alt={image.alt} loading="lazy" />
      )}
    </>
  );
}

export function UpdateCardSkeleton({ standalone }: { standalone?: boolean }) {
  return (
    <div className={styles.card} aria-hidden>
      <div className={styles.head}>
        <Line className="smallcaps" width="8rem" />
        <Line as={standalone ? "h1" : "h2"} className={styles.title} width="60%" />
      </div>
      <div className={styles.group}>
        <Line as="h3" className={styles.label} width="3rem" />
        <ul className={styles.lines}>
          {[2, 1, 2].map((count, i) => (
            <li key={i}>
              <Line className={styles.lead} width="9rem" />
              <Lines count={count} className={styles.text} />
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.group}>
        <Line as="h3" className={styles.label} width="4rem" />
        <ul className={styles.lines}>
          <li>
            <Line className={styles.lead} width="11rem" />
            <Lines count={1} className={styles.text} />
          </li>
        </ul>
      </div>
    </div>
  );
}
