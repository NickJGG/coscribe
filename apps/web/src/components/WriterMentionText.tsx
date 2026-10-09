"use client";

import { useMemo } from "react";
import { authorColorCss } from "@/lib/profile-rules";
import { writerMentionIds, writerMentionParts } from "@/lib/writer-mentions";
import { usePeople } from "./StoryMembers";
import styles from "./WriterMentions.module.css";

/** A message body with its Writer Mentions as `@username`: in Author Color for members, plain for anyone who left. */
export function WriterMentionText({ body }: { body: string }) {
  const parts = useMemo(() => writerMentionParts(body), [body]);
  const ids = useMemo(() => writerMentionIds(body), [body]);
  const person = usePeople(ids);

  return parts.map((part, i) => {
    if ("text" in part) return part.text;
    const who = person(part.writerId);
    if (!who) return `@${who === null ? "someone" : "…"}`;
    if (!who.member) return `@${who.name}`;
    return (
      <span
        key={i}
        className={styles.mention}
        style={{ "--author": authorColorCss(who.color) } as React.CSSProperties}
      >
        @{who.name}
      </span>
    );
  });
}
