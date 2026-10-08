"use client";

import { useEffect, useState } from "react";

/**
 * The result of `measure`, taken again on the next frame whenever anything inside `roots` changes or
 * resizes, or `measure` itself changes. Equal results (by JSON) don't re-render. A null `measure` gives
 * `empty`. `roots` must be stable.
 */
export function useMeasure<T>(
  roots: readonly React.RefObject<Element | null>[],
  measure: (() => T) | null,
  empty: T
): T {
  const [value, setValue] = useState(empty);

  useEffect(() => {
    const elements = roots.map((r) => r.current);
    if (!measure || elements.some((el) => !el)) return;
    let frame = 0;
    let last = "";
    const run = () => {
      frame = 0;
      const next = measure();
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      setValue(next);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(run);
    };
    schedule();
    const mutations = new MutationObserver(schedule);
    const resizes = new ResizeObserver(schedule);
    for (const el of elements as Element[]) {
      mutations.observe(el, { subtree: true, childList: true, characterData: true });
      resizes.observe(el);
    }
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
    };
  }, [roots, measure]);

  return measure ? value : empty;
}
