import { Bar, Loading } from "@/components/Skeleton";
import { Card, Sub } from "../Card";

export default function StorySettingsViewersLoading() {
  return (
    <Loading>
      <Card title="Viewers" description={<Bar width="20rem" />}>
        <Sub>
          <div className="rows">
            {["7rem", "9rem"].map((width, i) => (
              <div key={i} className="row">
                <Bar width={width} />
              </div>
            ))}
          </div>
        </Sub>
      </Card>
    </Loading>
  );
}
