import { Bar, Loading } from "@/components/Skeleton";
import { Card, Sub } from "../Card";

export default function StorySettingsWritersLoading() {
  return (
    <Loading>
      <Card title="Writers" description={<Bar width="11rem" />}>
        <Sub>
          <div className="rows">
            {["7rem", "9rem", "6rem"].map((width, i) => (
              <div key={i} className="row">
                <Bar width={width} />
                <Bar width="4.5rem" height={22} round />
              </div>
            ))}
          </div>
        </Sub>
      </Card>
    </Loading>
  );
}
