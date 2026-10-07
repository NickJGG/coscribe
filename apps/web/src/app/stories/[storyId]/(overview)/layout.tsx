import { SiteHeader } from "@/components/SiteHeader";
import { PanelSlot } from "@/components/StoryPanel";

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <PanelSlot variant="site" />
    </>
  );
}
