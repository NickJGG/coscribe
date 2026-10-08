"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./reader.module.css";

const SIZES = [0.9, 1, 1.125, 1.25];
const DEFAULT_SIZE = 1;
const SIZE_KEY = "coscribe:reader-size";
const listeners = new Set<() => void>();

function readSize() {
  try {
    const stored = Number(localStorage.getItem(SIZE_KEY) ?? NaN);
    return Number.isInteger(stored) && SIZES[stored] !== undefined ? stored : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

function writeSize(size: number) {
  try {
    if (size === DEFAULT_SIZE) localStorage.removeItem(SIZE_KEY);
    else localStorage.setItem(SIZE_KEY, String(size));
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribeSize(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const SizeContext = createContext(DEFAULT_SIZE);

/** The Reader's text size, remembered by this browser, applied to everything inside as `--reader-scale`. */
export function ReaderFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  const size = useSyncExternalStore(subscribeSize, readSize, () => DEFAULT_SIZE);
  return (
    <SizeContext value={size}>
      <div className={className} style={{ "--reader-scale": SIZES[size] } as React.CSSProperties}>
        {children}
      </div>
    </SizeContext>
  );
}

export function TextSize() {
  const size = useContext(SizeContext);
  return (
    <span className={styles.textSize} role="group" aria-label="Text size">
      <button type="button" onClick={() => writeSize(size - 1)} disabled={size === 0} aria-label="Smaller text">
        A
      </button>
      <button
        type="button"
        onClick={() => writeSize(size + 1)}
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
