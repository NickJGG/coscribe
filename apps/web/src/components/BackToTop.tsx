"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useDeskScroll } from "./DeskScroll";
import { ArrowUpIcon } from "./icons";
import { createSlot } from "./Slot";
import styles from "./BackToTop.module.css";

/** Over the desk's scrolling page, so the button floats over it rather than scrolling with it. */
export const BackToTopSlot = createSlot();

/**
 * A round button at the bottom centre of whatever scrolls, shown once you're more than one screen down: the
 * desk's page, or the window in the Reader.
 */
export function BackToTop() {
  const scroll = useDeskScroll();
  const desk = scroll !== null;
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = scroll?.current;
    if (desk && !el) return;
    const measure = () => setShown(el ? el.scrollTop > el.clientHeight : window.scrollY > window.innerHeight);
    measure();
    const target = el ?? window;
    target.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      target.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [scroll, desk, pathname]);

  return (
    <BackToTopSlot.Fill>
      <button
        type="button"
        className={`${styles.button} ${desk ? styles.desk : styles.reader} ${shown ? "" : styles.hidden}`}
        inert={!shown}
        aria-label="Back to top"
        data-tip="Back to top"
        onClick={() => {
          const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
          (scroll?.current ?? window).scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
        }}
      >
        <ArrowUpIcon className={styles.icon} />
      </button>
    </BackToTopSlot.Fill>
  );
}
