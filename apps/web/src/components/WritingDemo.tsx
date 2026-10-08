"use client";

import { useEffect, useState } from "react";
import { authorColorCss } from "@/lib/profile-rules";
import { DEMO_FULL, demoLength } from "@/lib/writing-demo";
import { AvatarStack } from "./Avatar";
import prose from "./LiveDocument.module.css";
import styles from "./WritingDemo.module.css";

const MAYA = { id: "maya", name: "maya", color: "#3e63dd" };
const THEO = { id: "theo", name: "theo", color: "#12a594" };

/** Two Writers on one page, drawn with the editor's own prose and caret styles. Still under reduced motion. */
export function WritingDemo() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const sync = () => {
      window.clearInterval(timer);
      if (reduce.matches) setTick(0);
      else timer = window.setInterval(() => setTick((t) => t + 1), 70);
    };
    sync();
    reduce.addEventListener("change", sync);
    return () => {
      window.clearInterval(timer);
      reduce.removeEventListener("change", sync);
    };
  }, []);

  return (
    <figure className={styles.demo} aria-label="An example of two Writers typing on the same page">
      <div className={`${prose.prose} ${styles.prose}`} aria-hidden>
        <p>
          The bells began at a quarter past two
          <Caret {...MAYA} />, when the sea had pulled back so far that Wren could see the old pilings.
        </p>
        <p>
          {DEMO_FULL.slice(0, demoLength(tick))}
          <Caret {...THEO} />
        </p>
      </div>
      <figcaption className={styles.foot}>
        <AvatarStack people={[MAYA, THEO]} size="sm" />
        <span>Example Story · 2 Writers, 14 Viewers</span>
      </figcaption>
    </figure>
  );
}

function Caret({ name, color }: { name: string; color: string }) {
  return (
    <span className="collaboration-carets__caret" style={{ "--author": authorColorCss(color) } as React.CSSProperties}>
      <span className="collaboration-carets__label">{name}</span>
    </span>
  );
}
