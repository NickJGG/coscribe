"use client";

import { useState } from "react";
import { Authorship, type StoryAuthor } from "./LiveDocument";
import { Switch } from "./Switch";

/** The "Show authors" switch around already-rendered text, for the Reader View. */
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
        <Switch checked={show} onChange={setShow}>
          Show authors
        </Switch>
      </div>
      <Authorship authors={authors} show={show}>
        {children}
      </Authorship>
    </>
  );
}
