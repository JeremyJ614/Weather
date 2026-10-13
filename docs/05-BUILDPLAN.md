# StormSync Weather BuildPlan

Living document. Updated at every phase. Any AI or person picking this up: read `BUILD_STATUS.md`, this file, `docs/04-DECISIONS.md`, then `docs/03-PHASES.md`. The owner's answers are stored in three lab artifacts (see BUILD_STATUS) and summarized here.

## 1. Product
One mobile-first app and website at **Weather.SSWX.Space**, named **StormSync Media** on the home screen, with the tornado mascot as its icon. It merges the team's apps: VIP Forecasts (`stormsync-dashboard/github-repo`), Chase Log (`Log`), StormSync Academy content (`stormsync-academy`) and the archive work (`stormsync-archive`). Every ported page gets a full redesign. Free to run until revenue.

## 2. Stack
| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript on Vercel Hobby |
| Install | PWA (iPhone Home Screen); Android `.apk` built free with Bubblewrap (Trusted Web Activity); stores later |
| Data | Supabase `weather` project (ztzqemzuanwqwqzsaigd): Postgres with RLS on every table, Auth, Storage (small files only), Edge Functions |
| Maps | One shared map component (`src/features/map/WeatherMap.tsx`): Mapbox GL JS v3 (one URL-restricted public token) with automatic fallback to MapLibre GL JS v6 on free OpenFreeMap tiles |
| 3D / motion | three.js + anime.js v4 (intro, select visuals); CSS transforms/opacity elsewhere |
| AI | Gemini API, server-only, every result cached |
| Email | Resend |
| Push | Web Push (VAPID) |
| Payments | Stripe (owner supplies pricing before the signup phase) |
| Engines | Python on GitHub Actions (hourly while private, more often once public), writing small GeoJSON that is overwritten in place |
| Analytics / errors | Vercel Analytics free tier; our own error log shown in the admin panel |

Secrets are server-only env vars (names: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PIN_PEPPER`). Never committed. The Mapbox token is a public `pk.` token restricted to our URLs (`NEXT_PUBLIC_MAPBOX_TOKEN`); a secret `sk.` token is refused in code.

## 3. Accounts, sign-in and roles
- **Sign-in:** a 4-digit PIN instead of a password, plus email sign-in link, Google and Apple (text-message codes dropped: not free). Supabase needs longer passwords, so the server turns the PIN into a long secret (keyed hash with `PIN_PEPPER` and the user id); the PIN itself is never stored. Five wrong PINs locks sign-in for 15 minutes, doubling each time, and offers the email link instead. A 4-digit PIN alone is weak, so admin actions also require a recently confirmed email code on a new device. Built (phase 08): `/login` (Google, email + PIN, email link), `/welcome` signup form, `/auth/callback`, PIN change on `/login` when signed in; profiles are created only by the server; a trigger stops members changing their own referral code, referrer, birthday or PIN flag.
- **Owner account:** created from the owner's email in chat; the PIN the owner gave is set at creation and never written to the repo.
- **Signup form (editable from the admin panel):** first and last name; optional nickname, then "use it as your display name?"; email; optional phone; city and state; birthday (must be 18+); how they found us; "referred by an SSWX Member?". Public name elsewhere: first name and last initial.
- **Referrals:** every account gets a numeric referral code. A code entered at signup credits the referrer (reward chosen by the owner in the admin panel). Admin panel lists members, adds/removes/edits them, and shows referral counts.
- **Roles:** Free User, subscription tiers, SSWX Member, SSWX Administration (a second role on top of any other), SSWX Founder (owner only, full access). Only the owner is admin at launch.
- **Without an account:** all free pages are open; everything else asks to sign in.

## 4. Look and feel
- **Menus:** see Decisions. Each menu style is a component that declares the screen spots its controls use; combining two moves the second to its next free spot. Same menu can't be both. Owner sets defaults in the admin panel; users change theirs in account settings and at the end of the intro guide.
- **Themes:** default VIP Gold + Editorial Crown. Users pick a ready-made template (the owner's 13 saved combos) or mix their own palette and font set from those offered. Changer in account settings only. A theme is a token swap; no component branches on the theme.
- **Intro:** the original (cube) version, cut to about 5 seconds. Plays once a day by default; users choose every launch / once a day / first launch only / off in account settings. Tiny "Created By: Jay Myers" appears with the finished lockup. Plays on all phones. **Waiting on:** the owner is sending the logo the ending should become; everything else stays the same.
- **Motion:** maximum by default, automatically toned down on slow phones and when the phone asks for reduced motion. Animate transform and opacity only.
- **Haptics:** on by default, user setting. **Sound:** none.
- **Units:** US only.

## 5. Platform rules
- **Maps:** every map, ported or new, uses the shared component. The app counts its own Mapbox map loads per month and switches all maps to MapLibre just before the free limit (45,000 of 50,000), then back when the month resets. Anything uncertain (no token, counter unreachable, a URL the token does not allow) uses MapLibre, so maps never cost money.
- **Storage safety:** `docs/06-STORAGE-SAFETY.md`. No rendered images in Supabase, retention on every growing table (enforced by a test), bounded cache keys, daily size watchdog with alerts at 60% and 80%.
- **Accounts for testing:** test users may be created in the live database and are deleted afterwards.
- **Git:** `main` is the production branch (owner approved).

## 5b. Weather data layer (phase 10)
- `src/lib/weather/nws.ts` (server only): NWS points, 7-day and 48-hour forecasts, normalized in `types.ts`. ZIP lookup via zippopotam.us.
- Coordinates are snapped to a 0.02° grid before any request or cache, so cache keys are bounded and no precise GPS position is stored.
- Caching: Next fetch cache (grid point 7 days, forecasts 15 min, ZIPs 30 days) plus edge caching on `/api/weather` and `/api/geo/zip`. Nothing is stored in Supabase.
- Saved places: up to 5 on the device (`sswx-places`), synced to the account in phase 08.

## 6. Sections
**Homepage.** Weather News: top 15 from NWS, SPC, NHC, NOAA news, NASA Earth, AP weather and Reuters climate, refreshed once at 7 AM Eastern, most severe first, no AI summaries. SSWX News: owner's posts with the editor; unread glow ends when opened or after 7 days. App Updates: new members by initials, game winners, releases.

**Localized Data.** Location by GPS or ZIP; up to 5 saved places with manual switching. Dashboard widgets: Today, 7-day, Hourly graph, SPC level, UV, Sunrise/sunset, Moon phase, Wind, Pressure trend, Feels like, Dew point, AQI, Pollen, Nearest river gauge. WPC, CPC and Fall Forecast subtabs per the outline. Daily Brief by in-app, push and email (SMS requests surface in the admin panel for the owner): today's forecast, SPC risk, active alerts, hourly rain timing, AQI and pollen, tomorrow at a glance. Forecast Discussion from the user's local office: Simplified (everyday language, AI) and Standard. AQI & Pollen, Mosquito Index ported; Daylight Tracker rebuilt.

**Community.** Forecast Game: VIP rules, easier location picking, a fully interactive map, full redesign. Daily Trivia: 3 AI-written questions a day, no approval, with a duplicate guard (stored question fingerprints and similarity check against the past year). Prizes as in VIP. Leaderboard weeks start Monday, Eastern time. Weekly Polls: results after voting. Raffles: post-launch.

**Severe Weather.** SSWXCon: review the VIP formula; keep it if sound, otherwise propose changes for approval. Push warnings: paid tiers and SSWX Members. Tropical: all five basins plus the Battle Royale, with the best one or two tropical models added. Hazards map layers: warnings, watches, advisories, radar, lightning, wildfires, road conditions, earthquakes. Severe Weather History: VIP ranges, plus last 7 days / month / 6 months / year for warnings and tornado paths. Storm Chasing Outlook: VIP stats carried over, redesigned. All other severe pages port from VIP with the redesign.

**Tools & Other Data.** Radar and Model Runs: VIP ported and redesigned, plus the best one or two tropical models. River & Flood Gauges with the top 5. 3D Soundings from balloons, HRRR, RAP, NAM 3 km and GFS. StormNet: add when their API is approved. Google DeepMind: Weather Lab AI cyclone tracks (WeatherNext Cyclones, owner checked the terms) join the Battle Royale and get their own subtab in the Tropical section next to the ported VIP hurricane tracker. WeatherNext live forecasts, AI probability maps and the Flood Hub API all need an access request with a wait, so they are left out; WeatherNext's historical archive (CC BY 4.0, no request) may be used for an "AI forecast scorecard" on past events. Traffic cameras: built, visible only to the owner until approved; aim for wider coverage and add weather/hazard cams.

**Specialty Monitoring.** Star Gazing: map plus a location score, plus everything star-related from VIP's Star Gazing & Aurora module. Aurora: two tabs (image and interactive) plus everything aurora-related from that module. Lightning: NOAA satellite lightning (GLM); look for other good free sources (no Blitzortung without permission). FairWeather: post-launch.

**Educational.** Climatology: tornado, lightning, and hurricanes. Glossary ported as is. Free Content Library copied from the Academy.

**Everything Else.** Weather Patterns: ported from VIP, which uses Gemini for its analysis; keep that, server-side and cached. Extras: access set engine by engine. Disaster Response: owner gives starting organizations when we reach it; form fields as chosen, with areas served, logo and social links optional.

**Account.** Profile: game stats, badges, leaderboard history, saved places, chase logs, member since, tier, plus more worth showing (streaks, referral count, contributions). Notifications toggles: warnings, watches, SPC upgrades, Daily Brief, SSWX News, game results, new trivia, new polls, tropical updates, aurora alerts, engine alerts.

**Second menu.** Official Tornado Archive: EF2+ since 2000 plus every EF4–EF5 since 1950; new NWS surveys publish automatically. Storm Chasing Log: paid tiers and SSWX Members; logs private until shared.

**Admin panel.** Phone-first. Built (phase 11): `/admin` dashboard of sections (unbuilt ones show their phase), Admins & access (Founder makes admins and picks their sections), Audit log (append-only), Storage watchdog. Admin pages return 404 to non-admins and need a Google or email-link session, not a PIN-only one. Outline requests + VIP AdminPanel (what fits) + the owner's 19 extras + our own. Includes engine preview/approval, owner-only previews (traffic cams), member and referral management, signup form editor, menu and theme defaults, storage watchdog, error log, SMS requests.

## 7. Engines
At launch: ProbTor, ProbHail, Nocturnal LLJ, Wildfire/PyroCb, Radar Blind Spot, Landspout/Waterspout, Rotation Track Persistence, Snow Squall, Landfalling Hurricane Tornado Risk. Post-launch engines are built in the private Engine Preview first. Access per engine is set in the admin panel.

## 8. Post-launch (on the plan, not on menus)
Personal Warnings & Alerts, Affected Communities Outlook, FairWeather Tracking, Raffles, Virtual Store, Services, Partnerships, Non-Profit Campaigns, Donations, Members Suite (Forum, Active Roster, 2026 Storm Chases, New Members Onboarding), App Store and Google Play listings, post-launch engines. Notes for later: Google AlphaEarth satellite embeddings and Earth Engine datasets (damage, burn scars, drought, flooded land; commercial use needs an Earth Engine license); WeatherNext live data and Flood Hub API if the owner later requests access.

## 9. Waiting on the owner
- Logo for the end of the intro.
- Pricing setup (before the signup phase).
- Disaster Response starting organizations (at that phase).
- Approval of any SSWXCon formula changes.

## 10. Bug & glitch log
| # | Where | Bug | Fix |
| --- | --- | --- | --- |
| 1 | Section A lab | Saved answers came back read-only, so later taps and notes silently stopped saving | Copy saved data on load |
| 2 | Section A lab | Corner Sweep overlay didn't cover the full screen | Fixed-size circles anchored to the corner |
| 3 | Theme Lab intro | On tall screens the final logo was beyond the camera's far limit and vanished | Far limit raised |
| 4 | Theme Lab intro | "Press Play" label stayed over the running animation | Hidden state styled explicitly |
| 6 | App icon | The mascot is only ~170 px tall inside the logo file, so the icon is slightly soft | Cut out and sharpened; a high-resolution mascot file from the owner would make it crisp |
| 7 | Theme system | The default theme's CSS block outranked themes listed before it, so some picks didn't apply | Default block uses zero-specificity `:where(:root)` |
| 8 | Launch intro | On tall screens the dropped floor stayed in view at the end once the far limit was raised | Floor hidden after it has fallen away |
| 9 | Menus | With one menu open, the other menu's button floated on top of it | The other menu hides while one is open |
| 10 | Menus | Three second-menu styles were written but never registered, so picking them silently fell back to Morph FAB | Registered; a test now requires every offered style to exist |
| 5 | Storm-edit intro | Later "from" values showed the hidden cube and bolt early | Visibility driven by timeline time |
| 11 | Shared map | The map rendered blank: the map libraries set `position: relative` on the map element, overriding its full-size positioning, so it collapsed to zero height | Map element sized with width/height 100% instead |
| 12 | Shared map | MapLibre v6 could not start its tile worker because the bundler does not emit the worker file | Worker copied to a versioned `public/vendor` path before dev/build and set with `setWorkerUrl` |
| 13 | Sign-in page | The Supabase browser library pushed `/login` 25% over the JavaScript budget | Google and email-link sign-in moved to server actions; the page ships 2.4 kB |
