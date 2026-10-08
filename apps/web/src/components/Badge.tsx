/** A count on an icon button. Decorative: the button's label carries the number. */
export function Badge({ count }: { count: number }) {
  return count ? (
    <span className="badge" aria-hidden>
      {count}
    </span>
  ) : null;
}
