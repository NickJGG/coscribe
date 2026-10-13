"use client";

import Link from "next/link";

/** Opens the New Story form under the header in place; the href is the no-JS fallback. */
export function NewStoryButton() {
  return (
    <Link
      href="/stories?new=1#new"
      className="button button-primary button-small"
      onClick={(e) => {
        const form = document.getElementById("new");
        if (!(form instanceof HTMLDetailsElement)) return;
        e.preventDefault();
        form.open = true;
        form.scrollIntoView({ block: "nearest" });
        form.querySelector<HTMLInputElement>("input[name=title]")?.focus();
      }}
    >
      New Story
    </Link>
  );
}
