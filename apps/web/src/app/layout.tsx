import type { Metadata } from "next";
import { Courier_Prime, Inter, Literata } from "next/font/google";
import { getViewer } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";
import { loadLatestNotifications } from "@/lib/notifications";
import { Heartbeat } from "@/components/Heartbeat";
import { HoverLabels } from "@/components/HoverLabels";
import { NotificationsProvider } from "@/components/Notifications";
import "./globals.css";

const ui = Inter({ subsets: ["latin"], variable: "--font-ui" });
const prose = Literata({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-prose" });
const script = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-script",
});

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
  const notifications = profile ? await loadLatestNotifications(await createClient()) : null;

  return (
    <html
      lang="en"
      className={`${ui.variable} ${prose.variable} ${script.variable}`}
      data-theme={theme && theme !== "system" ? theme : undefined}
    >
      <body>
        {profile && notifications ? (
          <NotificationsProvider userId={profile.id} initial={notifications}>
            {children}
          </NotificationsProvider>
        ) : (
          children
        )}
        {profile && <Heartbeat />}
        <HoverLabels />
      </body>
    </html>
  );
}
