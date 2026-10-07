import type { Metadata } from "next";
import { Inter, Literata } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const ui = Inter({ subsets: ["latin"], variable: "--font-ui" });
const prose = Literata({ subsets: ["latin"], variable: "--font-prose" });

export const metadata: Metadata = {
  title: { default: "Coscribe", template: "%s · Coscribe" },
  description: "Write one story together, live, with your friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ui.variable} ${prose.variable}`}>
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
