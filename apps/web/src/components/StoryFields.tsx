import styles from "./StoryFields.module.css";

/** Title and Visibility inputs, shared by the create form and the Host's settings form. */
export function StoryFields({
  title = "",
  visibility = "private",
}: {
  title?: string;
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

      <fieldset className={styles.field}>
        <legend className={styles.label}>Visibility</legend>
        <label className={styles.choice}>
          <input type="radio" name="visibility" value="private" defaultChecked={visibility === "private"} />
          <span>
            <strong>Private</strong> <span className="muted">Only its Writers can see it.</span>
          </span>
        </label>
        <label className={styles.choice}>
          <input type="radio" name="visibility" value="public" defaultChecked={visibility === "public"} />
          <span>
            <strong>Public</strong> <span className="muted">Anyone with the link can watch it being written.</span>
          </span>
        </label>
      </fieldset>
    </>
  );
}
