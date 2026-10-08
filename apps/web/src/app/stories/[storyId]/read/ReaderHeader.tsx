"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocalSetting } from "@/lib/local-setting";
import styles from "./reader.module.css";

const SIZES = [0.9, 1, 1.125, 1.25];
const DEFAULT_SIZE = 1;
const SIZE_KEY = "coscribe:reader-size";

const SizeContext = createContext<{ size: number; setSize: (size: number) => void }>({
  size: DEFAULT_SIZE,
  setSize: () => {},
});

/** The Reader's text size, remembered by this browser, applied to everything inside as `--reader-scale`. */
export function ReaderFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  const [stored, setSize] = useLocalSetting(SIZE_KEY, DEFAULT_SIZE);
  const size = Number.isInteger(stored) && SIZES[stored] !== undefined ? stored : DEFAULT_SIZE;
  return (
    <SizeContext value={{ size, setSize }}>
      <div className={className} style={{ "--reader-scale": SIZES[size] } as React.CSSProperties}>
        {children}
      </div>
    </SizeContext>
  );
}

export function TextSize() {
  const { size, setSize } = useContext(SizeContext);
  return (
    <span className={styles.textSize} role="group" aria-label="Text size">
      <button type="button" onClick={() => setSize(size - 1)} disabled={size === 0} aria-label="Smaller text">
        A
      </button>
      <button
        type="button"
        onClick={() => setSize(size + 1)}
        disabled={size === SIZES.length - 1}
        aria-label="Larger text"
      >
        A
      </button>
    </span>
  );
}

/** Contents, Story Bible and Credits. A Chapter page marks none of them. */
export function ReaderLinks({ storyId, hasBible }: { storyId: string; hasBible: boolean }) {
  const pathname = usePathname();
  const base = `/stories/${storyId}/read`;
  const links: [string, string][] = [
    ["Contents", base],
    ...(hasBible ? [["Story Bible", `${base}/bible`] as [string, string]] : []),
    ["Credits", `${base}/credits`],
  ];

  return (
    <nav className={styles.links} aria-label="Reader View">
      {links.map(([label, href]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
