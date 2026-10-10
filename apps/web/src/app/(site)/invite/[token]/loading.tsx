import { Bar, Line, Loading } from "@/components/Skeleton";

export default function InviteLoading() {
  return (
    <Loading>
      <div className="page">
        <Line className="muted" width="16rem" />
        <Line as="h1" width="60%" />
        <div>
          <Bar width={160} height={40} />
        </div>
      </div>
    </Loading>
  );
}
