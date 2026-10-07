"use client";

import { useState } from "react";

/** Copies `path` as an absolute URL on this site. */
export function CopyLinkButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="button"
      onClick={async () => {
        await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
