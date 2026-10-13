import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeviceSetup } from "@/components/DeviceSetup";
import { LaunchIntro } from "@/features/intro/LaunchIntro";
import { MenuHost } from "@/features/menus/MenuHost";
import { AppHeader } from "@/components/AppHeader";
import { introBootScript } from "@/features/intro/schedule";
import { themeBootScript, themeCss } from "@/lib/theme/css";
import { fontClassNames } from "@/lib/theme/fonts";
import { getSiteDefaults } from "@/lib/settings";

export const metadata: Metadata = {
  title: "StormSync Media",
  applicationName: "StormSync Media",
  appleWebApp: {
    capable: true,
    title: "StormSync",
    statusBarStyle: "black-translucent",
  },
  description:
    "Severe weather, forecasts and storm chasing from StormSync Media.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c14",
  viewportFit: "cover",
};

const css = themeCss();

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const defaults = await getSiteDefaults();
  return (
    <html
      lang="en"
      className={fontClassNames}
      data-palette={defaults.theme.palette}
      data-font={defaults.theme.font}
      suppressHydrationWarning
    >
      <head>
        <style id="themes" dangerouslySetInnerHTML={{ __html: css }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: introBootScript }} />
      </head>
      <body>
        <DeviceSetup />
        <LaunchIntro />
        <AppHeader />
        <div id="app-content" className="pt-16">
          {children}
        </div>
        <MenuHost defaults={defaults.menus} />
      </body>
    </html>
  );
}
