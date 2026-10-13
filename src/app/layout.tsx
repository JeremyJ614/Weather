import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeviceSetup } from "@/components/DeviceSetup";
import { LaunchIntro } from "@/features/intro/LaunchIntro";
import { introBootScript } from "@/features/intro/schedule";
import { themeBootScript, themeCss } from "@/lib/theme/css";
import { fontClassNames } from "@/lib/theme/fonts";
import { DEFAULT_THEME } from "@/lib/theme/registry";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={fontClassNames}
      data-palette={DEFAULT_THEME.palette}
      data-font={DEFAULT_THEME.font}
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
        {children}
      </body>
    </html>
  );
}
