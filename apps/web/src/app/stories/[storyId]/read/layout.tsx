import { SiteHeader } from "@/components/SiteHeader";

// Stand-in until the Reader gets its own header.
export default function ReaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
    </>
  );
}
