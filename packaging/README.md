# Packaging

One site, three ways to install it. Everything ships from `weather.sswx.space`.

| Target | What it is |
| --- | --- |
| **Website / PWA** | The product. Installs from the browser on Android, iPhone and desktop (`src/app/manifest.ts`, icons in `public/icons`). |
| **iPhone** | Safari → Share → Add to Home Screen. Full screen with its own icon (`appleWebApp` in `src/app/layout.tsx`); iOS sends web-push alerts only to Home Screen apps. |
| **Android APK** | A Trusted Web Activity built with Bubblewrap: the site full screen with no browser bar, its own icon, notifications through the site's web push. Downloadable at `/downloads/stormsync-weather.apk`, not sold through Google Play (Play Billing would take 15% of subscriptions). |

## Android

`android/twa-manifest.json` is the finished configuration (package `space.sswx.weather`,
Android 7.0 and up). To rebuild after a change to it (a new version, name, icon or
shortcut), with JDK 17 and the Android SDK:

```bash
npm i -g @bubblewrap/cli
cd packaging/android
# put android.keystore here (from the owner's safe copy; never commit it)
bubblewrap update            # regenerates the Android project from twa-manifest.json
bubblewrap build             # asks for the keystore password; writes app-release-signed.apk
```

Raise `appVersionCode` (and `appVersion`) for every new build, then copy
`app-release-signed.apk` to `public/downloads/stormsync-weather.apk`. Bubblewrap also writes
`app-release-bundle.aab` for stores that take bundles.

Two rules:

1. **Digital Asset Links.** `public/.well-known/assetlinks.json` carries the signing
   certificate's SHA-256 fingerprint. While it matches the key the APK was signed with, the
   app opens with no URL bar. A new key means a new fingerprint there, deployed first.
2. **The keystore never enters this repository** (`*.keystore` is gitignored). It is the
   only key that can sign updates the installed app accepts; losing it means everyone
   reinstalls.

Content changes need no new APK: the app shows the live site.
