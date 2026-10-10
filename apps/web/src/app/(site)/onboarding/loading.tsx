import { Loading } from "@/components/Skeleton";
import { ProfileFormSkeleton } from "@/components/ProfileFormSkeleton";

export default function OnboardingLoading() {
  return (
    <Loading>
      <div className="page">
        <h1>Welcome to Coscribe</h1>
        <p className="muted">Pick the name your friends will find you by, and the color your words show up in.</p>
        <ProfileFormSkeleton />
      </div>
    </Loading>
  );
}
