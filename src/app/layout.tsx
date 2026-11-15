import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DeviceSetup } from "@/components/DeviceSetup";
import { LaunchIntro } from "@/features/intro/LaunchIntro";
import { GuestGate } from "@/features/account/GuestGate";
import { PrefsSync } from "@/features/account/PrefsSync";
import { GuideHost } from "@/features/guide/GuideHost";
import { Notices } from "@/features/notify/Notices";
import { Suspense } from "react";
import { MenuHost } from "@/features/menus/MenuHost";
import { AppHeader } from "@/components/AppHeader";
import { introBootScript } from "@/features/intro/schedule";
import { decodeBootScript } from "@/features/motion/decode";
import { pullBootScript } from "@/features/motion/pull";
import { themeBootScript, themeCss } from "@/lib/theme/css";
import { fontClassNames } from "@/lib/theme/fonts";
import { getSiteDefaults } from "@/lib/settings";
import { applyLayout } from "@/lib/nav/layout";
import { MAIN_NAV, SECOND_NAV } from "@/lib/nav/registry";
import { extrasGroup } from "@/lib/nav/extras";
import { ErrorReporter } from "@/components/ops/ErrorReporter";
import { SiteBanner } from "@/components/ops/SiteBanner";
import { ViewAsBar } from "@/components/ops/ViewAsBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { siteGraph } from "@/lib/seo/schema";
import { SITE } from "@/lib/seo/site";

const verify = {
  google: process.env.GOOGLE_SITE_VERIFICATION,
  bing: process.env.BING_SITE_VERIFICATION,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name}: live radar, SPC outlooks and storm chasing`,
    template: `%s · ${SITE.name}`,
  },
  applicationName: SITE.name,
  description: SITE.description,
  publisher: SITE.publisher,
  category: "weather",
  appleWebApp: {
    capable: true,
    title: "StormSync",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: { siteName: SITE.name, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "SSWX News" }],
    },
  },
  // Search Console and Bing Webmaster ownership, when the owner sets the env vars.
  verification: {
    ...(verify.google && { google: verify.google }),
    ...(verify.bing && { other: { "msvalidate.01": verify.bing } }),
  },
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
  // Extras items with pages of their own join the main menu as an "Extras" section.
  const extra = extrasGroup(defaults.extras);
  const mains = extra.pages.length ? [...MAIN_NAV, extra] : MAIN_NAV;
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
        <script dangerouslySetInnerHTML={{ __html: decodeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: pullBootScript }} />
      </head>
      <body>
        <JsonLd data={siteGraph} />
        <DeviceSetup />
        <ErrorReporter />
        <LaunchIntro />
        <AppHeader />
        <div id="app-content" className="pt-16">
          <SiteBanner
            text={defaults.banner.text}
            until={defaults.banner.until}
          />
          {children}
        </div>
        <ViewAsBar />
        <Suspense>
          <GuestGate />
          <GuideHost menus={defaults.menus} />
        </Suspense>
        <Notices />
        <PrefsSync />
        <MenuHost
          defaults={defaults.menus}
          main={applyLayout(mains, SECOND_NAV, defaults.layout, "main")}
          second={applyLayout(SECOND_NAV, mains, defaults.layout, "second")}
        />
      </body>
    </html>
  );
}
