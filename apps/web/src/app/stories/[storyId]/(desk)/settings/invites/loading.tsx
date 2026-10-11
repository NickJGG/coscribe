import { Bar, Loading } from "@/components/Skeleton";
import { Card, Sub } from "../Card";
import styles from "../settings.module.css";

export default function StorySettingsInvitesLoading() {
  return (
    <Loading>
      <Card title="Invites" description="Each Invite makes one person a Writer.">
        <Sub>
          <h3>Invite a Friend</h3>
          <div className="rows">
            {["7rem", "9rem"].map((width, i) => (
              <div key={i} className="row">
                <Bar width={width} />
                <Bar width={62} height={32} />
              </div>
            ))}
          </div>
        </Sub>
        <Sub>
          <div className={styles.inlineRow}>
            <div>
              <h3>Invite Links</h3>
              <p className="muted">Each link works once, for one person. Send it privately.</p>
            </div>
            <Bar width={150} height={40} />
          </div>
        </Sub>
      </Card>
    </Loading>
  );
}
