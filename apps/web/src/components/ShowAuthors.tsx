"use client";

import { useState } from "react";
import { Authorship, type StoryAuthor } from "./LiveDocument";
import liveStyles from "./LiveDocument.module.css";

/** The "Show authors" toggle around already-rendered text, for the Reader View. */
export function ShowAuthors({
  authors,
  toggleClassName,
  children,
}: {
  authors: StoryAuthor[];
  toggleClassName?: string;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <>
      <div className={toggleClassName}>
        <label className={liveStyles.toggle}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show authors
        </label>
      </div>
      <Authorship authors={authors} show={show}>
        {children}
      </Authorship>
    </>
  );
}
