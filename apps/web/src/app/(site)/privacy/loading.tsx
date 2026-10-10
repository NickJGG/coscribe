import { Lines, Loading } from "@/components/Skeleton";

export default function PrivacyLoading() {
  return (
    <Loading>
      <div className="page">
        <h1>Privacy</h1>
        <Lines count={2} />
        <Lines count={4} />
        <Lines count={5} />
      </div>
    </Loading>
  );
}
