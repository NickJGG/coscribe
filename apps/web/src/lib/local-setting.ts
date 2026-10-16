"use client";

import { useCallback, useSyncExternalStore } from "react";

type Setting = boolean | number | string;

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read<T extends Setting>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    if (typeof fallback === "boolean") return (raw === "1") as T;
    if (typeof fallback === "string") return raw as T;
    const n = Number(raw);
    return (Number.isFinite(n) ? n : fallback) as T;
  } catch {
    return fallback;
  }
}

function write<T extends Setting>(key: string, fallback: T, value: T) {
  try {
    if (value === fallback) localStorage.removeItem(key);
    else localStorage.setItem(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  } catch {}
  listeners.forEach((listener) => listener());
}

/**
 * A per-browser preference in localStorage, shared live by every component reading `key` (and other tabs).
 * The default is stored as no entry at all; the server render always sees the default.
 */
export function useLocalSetting(key: string, fallback: boolean): [boolean, (value: boolean) => void];
export function useLocalSetting(key: string, fallback: number): [number, (value: number) => void];
export function useLocalSetting(key: string, fallback: string): [string, (value: string) => void];
export function useLocalSetting<T extends Setting>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback
  );
  const set = useCallback((next: T) => write(key, fallback, next), [key, fallback]);
  return [value, set];
}
