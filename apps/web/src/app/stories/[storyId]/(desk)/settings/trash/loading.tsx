import { Bar, Line, Loading } from "@/components/Skeleton";
import { Card, Sub } from "../Card";
import styles from "../settings.module.css";

export default function StorySettingsTrashLoading() {
  return (
    <Loading>
      <Card title="Trash" description={<Bar width="26rem" />}>
        <Sub>
          <div className="rows">
            {["9rem", "12rem"].map((width, i) => (
              <div key={i} className="row">
                <div>
                  <Bar width={width} />
                  <Line className={`muted ${styles.trashMeta}`} width="16rem" />
                </div>
              </div>
            ))}
          </div>
        </Sub>
      </Card>
    </Loading>
  );
}
