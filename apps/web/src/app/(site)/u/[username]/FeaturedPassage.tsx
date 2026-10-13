import Link from "next/link";
import type { JSONContent } from "@tiptap/core";
import { removeFeaturedPassage } from "@/lib/actions/passages";
import { authorColorCss } from "@/lib/profile-rules";
import { ActionForm } from "@/components/ActionForm";
import { ProseView } from "@/components/ProseView";
import scriptStyles from "@/components/Script.module.css";
import styles from "./profile.module.css";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type Passage = {
  storyId: string;
  storyTitle: string;
  chapterId: string;
  chapterNumber: number;
  finished: boolean;
  content: JSONContent;
  /** The profile User's Author Color in the passage's Story. */
  color: string;
};

/**
 * The profile User's Featured Passage as a pull quote, their own runs tinted like Show authors. The owner
 * also sees why it's hidden (RLS hides it from everyone else while its Story isn't Finished), and how to
 * feature one once they have a Finished Story.
 */
export function FeaturedPassage({
  passage,
  userId,
  self,
  canFeature,
}: {
  passage: Passage | null;
  userId: string;
  self: boolean;
  canFeature: boolean;
}) {
  if (!passage) {
    if (!self || !canFeature) return null;
    return (
      <div className={styles.choose}>
        <span className={styles.label}>Featured Passage</span>
        <span>
          Show visitors how you write: select a passage you wrote in a Finished Story&rsquo;s Reader View, then choose
          &ldquo;Feature on my profile&rdquo;.
        </span>
      </div>
    );
  }

  if (!passage.finished) {
    if (!self) return null;
    return (
      <div className={styles.choose}>
        <span className={styles.label}>Featured Passage · hidden</span>
        <span>
          Your passage from <em>{passage.storyTitle}</em> is hidden while it&rsquo;s being written again. It comes back
          when the Story is Finished.
        </span>
      </div>
    );
  }

  const mine = `.${styles.passage} span[data-author="${userId}"]`;
  return (
    <figure className={styles.passage}>
      {HEX_COLOR.test(passage.color) && <style>{`${mine}{--run:${authorColorCss(passage.color)};color:var(--ink)}`}</style>}
      <blockquote className={scriptStyles.scripts}>
        <ProseView content={passage.content} />
      </blockquote>
      <figcaption>
        From <Link href={`/stories/${passage.storyId}/read/${passage.chapterId}`}>{passage.storyTitle}</Link> · Chapter{" "}
        {passage.chapterNumber}
        {self && (
          <>
            {" · "}
            <ActionForm action={removeFeaturedPassage} className={styles.remove}>
              <button className="link-button">Remove</button>
            </ActionForm>
          </>
        )}
      </figcaption>
    </figure>
  );
}
