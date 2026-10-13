import { Bar, Lines, Loading } from "@/components/Skeleton";
import fields from "@/components/StoryFields.module.css";
import { Card, Sub } from "../Card";
import styles from "../settings.module.css";

export default function StorySettingsStoryLoading() {
  return (
    <Loading>
      <Card title="Story" description="What everyone sees: title, Blurb and who can watch.">
        <Sub>
          <div className={styles.form}>
            <div className={fields.field}>
              <span className={fields.label}>Title</span>
              <Bar width={320} height={40} />
            </div>
            <div className={fields.field}>
              <span className={fields.label}>Blurb</span>
              <Bar width={480} height={90} />
              <span className={`muted ${fields.hint}`}>Optional. A line or two under the title.</span>
            </div>
            <div className={fields.field}>
              <span className={fields.label}>Visibility</span>
              <Bar width="14rem" />
              <Bar width="22rem" />
            </div>
            <Bar width={70} height={40} />
          </div>
        </Sub>
        <Sub>
          <div className={styles.inlineRow}>
            <div>
              <h3>Finished</h3>
              <Lines count={2} className="muted" />
            </div>
            <Bar width={130} height={40} />
          </div>
        </Sub>
      </Card>

      <Card title="Leave or delete" danger>
        <Sub>
          <div className={styles.inlineRow}>
            <div>
              <h3>Delete story</h3>
              <p className="muted">Removes it for everyone. It waits in your Trash for 30 days, where you can restore it. To leave instead, hand off Host first.</p>
            </div>
            <Bar width={120} height={40} />
          </div>
        </Sub>
      </Card>
    </Loading>
  );
}
