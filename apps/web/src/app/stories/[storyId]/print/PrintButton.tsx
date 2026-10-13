"use client";

import { useEffect, useRef } from "react";
import styles from "./print.module.css";

/**
 * Pins the light theme while the print page is open, opens the print dialog once the fonts have loaded (so the PDF
 * isn't set in fallbacks), and offers a button to print again.
 */
export function PrintButton() {
  const printed = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    const theme = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "light");

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled || printed.current) return;
      printed.current = true;
      window.print();
    });

    return () => {
      cancelled = true;
      if (theme === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", theme);
    };
  }, []);

  return (
    <div className={styles.toolbar}>
      <button type="button" className="button button-primary" onClick={() => window.print()}>
        Print or save as PDF
      </button>
    </div>
  );
}
