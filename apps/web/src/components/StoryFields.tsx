import { BLURB_MAX } from "@/lib/story-form";
import styles from "./StoryFields.module.css";

/** Title, Blurb and Visibility inputs, shared by the create form and the Host's settings form. */
export function StoryFields({
  title = "",
  blurb = "",
  visibility = "private",
}: {
  title?: string;
  blurb?: string | null;
  visibility?: "public" | "private";
}) {
  return (
    <>
      <div className={styles.field}>
        <label htmlFor="title" className={styles.label}>
          Title
        </label>
        <input id="title" name="title" className="input" defaultValue={title} maxLength={120} required />
      </div>

      <div className={styles.field}>
        <label htmlFor="blurb" className={styles.label}>
          Blurb
        </label>
        <textarea
          id="blurb"
          name="blurb"
          className={`input ${styles.textarea}`}
          defaultValue={blurb ?? ""}
          maxLength={BLURB_MAX}
          rows={3}
          aria-describedby="blurb-hint"
        />
        <span id="blurb-hint" className={`muted ${styles.hint}`}>
          Optional. A line or two under the title.
        </span>
      </div>

      <fieldset className={styles.field}>
        <legend className={styles.label}>Visibility</legend>
        <label className="choice">
          <input type="radio" name="visibility" value="private" defaultChecked={visibility === "private"} />
          <span>
            <strong>Private</strong> <span className="muted">Only its Writers can see it.</span>
          </span>
        </label>
        <label className="choice">
          <input type="radio" name="visibility" value="public" defaultChecked={visibility === "public"} />
          <span>
            <strong>Public</strong> <span className="muted">Anyone with the link can watch it being written.</span>
          </span>
        </label>
      </fieldset>
    </>
  );
}
