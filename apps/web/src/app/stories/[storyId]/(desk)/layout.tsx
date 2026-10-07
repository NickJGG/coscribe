import { SiteHeader } from "@/components/SiteHeader";

// Stand-in until the desk header and sidebar replace the Site header here.
export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
    </>
  );
}
