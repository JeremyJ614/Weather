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
import { tapMorphBootScript } from "@/features/motion/tapmorph";
import { embedBootScript } from "@/features/embed/boot";
import { holoBootScript } from "@/features/motion/holo";
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

/*
 * After a deploy the site answers 404 for the previous build's script chunks, while the installed app may still run
 * an earlier page, so the first lazy load (the radar decoders, a chart) fails (Fix It List #35, 1 and 2). An inline
 * script, so it works even when the app's own chunks are the stale ones: the page reloads itself once, at most every
 * ten minutes, so it can never loop.
 */
const staleBootScript = `(function(){var r=/chunk|dynamically imported|module script/i;function f(e){try{var m=String((e&&e.message)||e);if(!r.test(m))return;if(Date.now()-Number(sessionStorage.sswxStale||0)<6e5)return;sessionStorage.sswxStale=Date.now();location.reload()}catch(_){}}addEventListener("error",function(e){f(e.error||e.message)});addEventListener("unhandledrejection",function(e){f(e.reason)})})();`;

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
  // Google Discover shows big pictures only for sites that allow them (B7).
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
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
        <script dangerouslySetInnerHTML={{ __html: tapMorphBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: staleBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: holoBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: embedBootScript }} />
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
