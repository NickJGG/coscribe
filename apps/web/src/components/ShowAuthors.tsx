"use client";

import { useState } from "react";
import { Authorship, type StoryAuthor } from "./Authorship";
import { Switch } from "./Switch";

/** The "Show authors" switch around already-rendered text, for the Reader View, after any other `tools`. */
export function ShowAuthors({
  authors,
  toggleClassName,
  tools,
  children,
}: {
  authors: StoryAuthor[];
  toggleClassName?: string;
  tools?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [show, setShow] = useState(false);

  return (
    <>
      <div className={toggleClassName}>
        {tools}
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
