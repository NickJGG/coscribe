import { SiteHeader } from "@/components/SiteHeader";

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
    </>
  );
}
