import { Bar, Line, Loading } from "@/components/Skeleton";
import swatches from "@/components/ColorSwatches.module.css";
import { Card, Sub } from "../Card";
import styles from "../settings.module.css";

export default function StorySettingsYouLoading() {
  return (
    <Loading>
      <Card title="You" description="Only affects you, in this Story.">
        <Sub>
          <h3>Your color</h3>
          <Line className={`muted ${styles.hint}`} width="70%" />
          <div className={swatches.swatches}>
            {Array.from({ length: 12 }, (_, i) => (
              <Bar key={i} width={40} height={40} round />
            ))}
          </div>
        </Sub>
        <Sub>
          <div className={styles.choices}>
            <h3>Notifications</h3>
            <Bar width="16rem" />
            <Bar width="24rem" />
          </div>
        </Sub>
      </Card>
    </Loading>
  );
}
