"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "@/components/IntentLink";
import {
  Bell,
  Download,
  EllipsisVertical,
  Ellipsis,
  FolderOpen,
  Menu,
  Package,
  Share,
  ShieldCheck,
  Smartphone,
  SquarePlus,
  TabletSmartphone,
} from "lucide-react";
import { APK_URL } from "./install-links";
import s from "./InstallGuide.module.css";

const K = ({ icon, children }: { icon?: ReactNode; children: ReactNode }) => (
  <span className={s.key}>
    {icon}
    {children}
  </span>
);

const Step = ({ title, children }: { title: string; children?: ReactNode }) => (
  <li>
    <div>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  </li>
);

/**
 * Step-by-step install guides (Fix list 2026-10-30 #4) for iPhone, Android (from the browser)
 * and the Android app file. Built into the FAQ page, so the owner's own FAQ edits can never
 * drop them; the guide for the phone being used is outlined.
 */
export function InstallGuide() {
  const [mine, setMine] = useState<"iphone" | "android" | null>(null);
  useEffect(() => {
    queueMicrotask(() => {
      const ua = navigator.userAgent;
      setMine(
        /iphone|ipad|ipod/i.test(ua) ||
          (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
          ? "iphone"
          : /android/i.test(ua)
            ? "android"
            : null,
      );
    });
  }, []);
  const here = <span className={s.mine}>This phone</span>;

  return (
    <div className={s.wrap}>
      <p className={s.lead}>
        StormSync Weather installs straight from this website: no App Store or
        Play Store needed. Installed, it opens full screen with its own icon,
        stays signed in, and can send you alerts like any other app. It always
        runs the newest version, so there is nothing to update by hand.
      </p>
      <nav className={s.jump} aria-label="Install guides">
        <a href="#install-iphone">
          <Smartphone aria-hidden /> iPhone &amp; iPad
        </a>
        <a href="#install-android">
          <TabletSmartphone aria-hidden /> Android
        </a>
        <a href="#install-apk">
          <Package aria-hidden /> Android app file (APK)
        </a>
      </nav>

      <section
        id="install-iphone"
        className={s.guide}
        data-mine={mine === "iphone"}
        aria-labelledby="install-iphone-h"
      >
        <header>
          <Smartphone aria-hidden />
          <div>
            <h2 id="install-iphone-h">
              iPhone &amp; iPad {mine === "iphone" && here}
            </h2>
            <p>About a minute. Works on iOS 16.4 and newer.</p>
          </div>
        </header>
        <ol className={s.steps}>
          <Step title="Open weather.sswx.space in Safari">
            Safari is the most reliable. Chrome and Edge on iPhone work too
            (their Share button is in the address bar). If you followed a link
            inside Instagram, Facebook, TikTok or a text app, tap that
            app&apos;s <K icon={<Ellipsis aria-hidden />}>menu</K> and choose{" "}
            <b>Open in Safari</b> first: apps&apos; built-in browsers can&apos;t
            install anything.
          </Step>
          <Step title="Tap the Share button">
            It&apos;s the{" "}
            <K icon={<Share aria-hidden />}>square with an arrow pointing up</K>
            , at the bottom of the screen (on iPad, at the top right). On iOS
            26, if the bottom bar shows only the address, tap{" "}
            <K icon={<Ellipsis aria-hidden />}>More</K> first, then <b>Share</b>
            .
          </Step>
          <Step title="Choose Add to Home Screen">
            Scroll down the list of actions and tap{" "}
            <K icon={<SquarePlus aria-hidden />}>Add to Home Screen</K>. If you
            don&apos;t see it, tap <b>Edit Actions</b> at the very bottom and
            add it.
          </Step>
          <Step title="Keep “Open as Web App” on, then tap Add">
            The name is filled in as StormSync. Keep <b>Open as Web App</b>{" "}
            switched on (newer iPhones show this switch) so it opens full
            screen, then tap <b>Add</b> at the top right.
          </Step>
          <Step title="Open StormSync from your Home Screen">
            Find the new StormSync icon (swipe through your pages, or search for
            it) and open it there from now on, not from Safari. Sign in once and
            it stays signed in.
          </Step>
          <Step title="Turn on alerts (optional)">
            In the app, open <Link href="/notifications">Notifications</Link>,
            pick what you want and tap <K icon={<Bell aria-hidden />}>Allow</K>{" "}
            when your iPhone asks. Apple only sends web alerts to apps added to
            the Home Screen, so do this from the icon, not from Safari.
          </Step>
        </ol>
        <div className={s.tips}>
          <h3>If something&apos;s off</h3>
          <p>
            <b>No “Add to Home Screen”:</b> you&apos;re in a Private tab, in
            another app&apos;s browser, or Screen Time limits websites. Use a
            normal Safari tab.
          </p>
          <p>
            <b>It opens with Safari&apos;s address bar:</b> delete the icon and
            add it again with <b>Open as Web App</b> on.
          </p>
          <p>
            <b>No alerts:</b> Settings → Notifications → StormSync → Allow
            Notifications, and check that a Focus mode isn&apos;t holding them.
          </p>
          <p>
            <b>To remove it:</b> press and hold the icon, tap <b>Remove App</b>,
            then <b>Delete from Home Screen</b>. Your account and settings stay
            safe online.
          </p>
        </div>
      </section>

      <section
        id="install-android"
        className={s.guide}
        data-mine={mine === "android"}
        aria-labelledby="install-android-h"
      >
        <header>
          <TabletSmartphone aria-hidden />
          <div>
            <h2 id="install-android-h">
              Android, from the browser {mine === "android" && here}
            </h2>
            <p>
              The quickest way on any Android phone. Prefer an app file? See the{" "}
              <a href="#install-apk">APK guide</a> below.
            </p>
          </div>
        </header>
        <ol className={s.steps}>
          <Step title="Open weather.sswx.space in Chrome">
            Chrome works best. Samsung Internet, Edge and Firefox work too (see
            the tips below). If you&apos;re inside another app&apos;s browser,
            open its menu and choose <b>Open in Chrome</b>.
          </Step>
          <Step title="Tap Install if Chrome offers it">
            Chrome often shows an <b>Install app</b> bar or an install icon in
            the address bar. Tap it and skip to step 4. Signed in already?{" "}
            <Link href="/settings">Account Settings</Link> has an{" "}
            <b>Install StormSync Weather</b> button whenever your browser offers
            one.
          </Step>
          <Step title="Otherwise, use the menu">
            Tap <K icon={<EllipsisVertical aria-hidden />}>menu</K> at the top
            right, then <b>Add to Home screen</b> (or <b>Install app</b>), and
            choose <b>Install</b> if Chrome asks whether to install or make a
            shortcut.
          </Step>
          <Step title="Confirm Install">
            Tap <b>Install</b>. After a few seconds StormSync shows up in your
            app drawer and on your Home screen; press and hold to move it.
          </Step>
          <Step title="Open it and turn on alerts (optional)">
            Open StormSync from its icon, sign in, then open{" "}
            <Link href="/notifications">Notifications</Link> and tap{" "}
            <K icon={<Bell aria-hidden />}>Allow</K> when Android asks.
          </Step>
        </ol>
        <div className={s.tips}>
          <h3>Other browsers and fixes</h3>
          <p>
            <b>Samsung Internet:</b> tap <K icon={<Menu aria-hidden />}>menu</K>{" "}
            at the bottom right, then <b>Add page to</b> → <b>Home screen</b>.
          </p>
          <p>
            <b>Firefox:</b> tap{" "}
            <K icon={<EllipsisVertical aria-hidden />}>menu</K> →{" "}
            <b>Add app to Home screen</b> (or <b>Install</b>).
          </p>
          <p>
            <b>No alerts:</b> Settings → Apps → StormSync → Notifications → on.
            Battery savers can hold alerts back: set StormSync&apos;s battery
            use to <b>Unrestricted</b>.
          </p>
          <p>
            <b>To remove it:</b> press and hold the icon, then <b>Uninstall</b>.
          </p>
        </div>
      </section>

      <section
        id="install-apk"
        className={s.guide}
        aria-labelledby="install-apk-h"
      >
        <header>
          <Package aria-hidden />
          <div>
            <h2 id="install-apk-h">Android app file (APK)</h2>
            <p>
              The same app wrapped as a real Android app: a signed package
              (space.sswx.weather) you install yourself, outside the Play Store.
              It opens this site full screen and updates with it.
            </p>
          </div>
        </header>
        <a className={s.download} href={APK_URL} download>
          <Download aria-hidden /> Download the Android app (APK)
        </a>
        <p className={s.facts}>
          StormSync Weather 1.0.0 · about 2.3 MB · Android 7.0 and newer · for
          Android phones and tablets only (iPhones can&apos;t open APK files:
          use the iPhone guide above).
        </p>
        <ol className={s.steps}>
          <Step title="Download the file on your Android phone">
            Tap the button above. Chrome may say the file{" "}
            <b>might be harmful</b>: it says that for every app file from
            outside the Play Store. Tap <b>Download anyway</b>.
          </Step>
          <Step title="Open the downloaded file">
            Tap <b>Open</b> in the download message, or find{" "}
            <b>stormsync-weather.apk</b> in{" "}
            <K icon={<FolderOpen aria-hidden />}>Files</K> → <b>Downloads</b>{" "}
            and tap it.
          </Step>
          <Step title="Allow installs from your browser (first time only)">
            Android may say it can&apos;t install unknown apps from this source.
            Tap <b>Settings</b>, switch on <b>Allow from this source</b>, then
            tap back. You can switch it off again once StormSync is installed.
          </Step>
          <Step title="Tap Install">
            If Google Play Protect offers to scan the app, tap <b>Scan app</b>
            and let it finish. If it warns that the app is from an unknown
            developer (true of anything outside the Play Store), choose{" "}
            <b>More details</b> → <b>Install anyway</b>.
          </Step>
          <Step title="Open StormSync and sign in">
            Tap <b>Open</b>, or find StormSync in your app drawer. Sign in once,
            then turn on alerts from{" "}
            <Link href="/notifications">Notifications</Link> if you want them.
          </Step>
        </ol>
        <div className={s.tips}>
          <h3>Good to know</h3>
          <p>
            <b>Updates:</b> the app shows the live site, so every improvement
            reaches you by itself. You only download the file again if we post a
            new app version here.
          </p>
          <p>
            <b>“App not installed”:</b> an older copy signed differently is on
            the phone. Uninstall StormSync first, then install again.
          </p>
          <p>
            <ShieldCheck
              aria-hidden
              className="mr-1 inline size-3.5 align-[-2px]"
            />
            Only download the app from this page (weather.sswx.space). We never
            send app files by text or email.
          </p>
          <p>
            <b>To remove it:</b> press and hold the icon, then <b>Uninstall</b>.
          </p>
        </div>
      </section>
    </div>
  );
}
