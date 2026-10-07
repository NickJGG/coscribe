import type { Metadata } from "next";
import { Inter, Literata } from "next/font/google";
import { getViewer } from "@/lib/viewer";
import { Heartbeat } from "@/components/Heartbeat";
import "./globals.css";

const ui = Inter({ subsets: ["latin"], variable: "--font-ui" });
const prose = Literata({ subsets: ["latin"], variable: "--font-prose" });

export const metadata: Metadata = {
  title: { default: "Coscribe", template: "%s · Coscribe" },
  description: "Write one story together, live, with your friends.",
};

/** The one root layout: each shell (Site, desk, Reader) adds its own header beneath it. */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = (await getViewer())?.profile;
  const theme = profile?.theme;

  return (
    <html
      lang="en"
      className={`${ui.variable} ${prose.variable}`}
      data-theme={theme && theme !== "system" ? theme : undefined}
    >
      <body>
        {children}
        {profile && <Heartbeat />}
      </body>
    </html>
  );
}
